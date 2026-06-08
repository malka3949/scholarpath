import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { StudentService } from '../student/student.service';
import { RuleFilterService } from './rule-filter.service';
import { ProfileSummarizerService } from '../ai/profile-summarizer.service';
import { ClaudeService } from '../ai/claude.service';
import { BehaviorBoostService } from './behavior-boost.service';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentService: StudentService,
    private readonly ruleFilter: RuleFilterService,
    private readonly profileSummarizer: ProfileSummarizerService,
    private readonly claude: ClaudeService,
    private readonly behaviorBoost: BehaviorBoostService,
  ) {}

  async getRecommendations(userId: string) {
    const existing = await this.prisma.recommendation.findMany({
      where: { userId },
      include: { scholarship: true },
      orderBy: { score: 'desc' },
    });

    if (existing.length > 0) {
      return {
        source: this.claude.isAvailable() ? 'ai' : 'rules',
        computedAt: existing[0].computedAt,
        items: existing.map((r) => ({
          id: r.id,
          score: r.score,
          matchReason: r.matchReason,
          scholarship: r.scholarship,
        })),
      };
    }

    return this.refreshRecommendations(userId);
  }

  async refreshRecommendations(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('פרופיל לא נמצא — השלם את הפרופיל תחילה');
    }

    if (!this.studentService.isProfileComplete(profile)) {
      throw new BadRequestException(
        'יש להשלים תחום לימודים, שנת לימודים וממוצע לפני קבלת המלצות',
      );
    }

    const allScholarships = await this.prisma.scholarship.findMany();
    const ruleMatches = this.ruleFilter.filterAndScore(profile, allScholarships);

    if (ruleMatches.length === 0) {
      await this.prisma.recommendation.deleteMany({ where: { userId } });
      return {
        source: 'rules',
        computedAt: new Date(),
        items: [],
      };
    }

    const ruleScoreMap = new Map(
      ruleMatches.map((m) => [m.scholarship.id, m.ruleScore]),
    );
    const candidates = ruleMatches.map((m) => m.scholarship);
    const profileSummary = this.profileSummarizer.summarize(profile);

    const aiRankings = await this.claude.rankScholarships(
      profileSummary,
      candidates,
      ruleScoreMap,
    );

    const rankingMap = new Map(aiRankings.map((r) => [r.scholarshipId, r]));

    const toStore = await Promise.all(
      ruleMatches.map(async (match) => {
        const ai = rankingMap.get(match.scholarship.id);
        const baseScore = ai?.score ?? match.ruleScore;
        const boost = await this.behaviorBoost.calculateBoost(
          userId,
          match.scholarship.id,
        );
        const score = Math.min(100, Math.round(baseScore * 0.85 + boost));
        let matchReason = ai?.reason ?? match.ruleReason;
        if (boost > 0) {
          matchReason = `${matchReason} · מוגבר לפי פעילות`;
        }
        return {
          userId,
          scholarshipId: match.scholarship.id,
          score,
          matchReason,
        };
      }),
    );

    toStore.sort((a, b) => b.score - a.score);

    await this.prisma.$transaction([
      this.prisma.recommendation.deleteMany({ where: { userId } }),
      this.prisma.recommendation.createMany({ data: toStore }),
    ]);

    const stored = await this.prisma.recommendation.findMany({
      where: { userId },
      include: { scholarship: true },
      orderBy: { score: 'desc' },
    });

    return {
      source: this.claude.isAvailable() ? 'ai' : 'rules',
      computedAt: stored[0]?.computedAt ?? new Date(),
      items: stored.map((r) => ({
        id: r.id,
        score: r.score,
        matchReason: r.matchReason,
        scholarship: r.scholarship,
      })),
    };
  }
}
