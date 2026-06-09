import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApplicationStatus,
  RelatedEntityType,
  Role,
  UserActionStatus,
  UserActionType,
} from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import { ActionExpirationService } from './action-expiration.service';
import { ActionScoringService } from './action-scoring.service';
import {
  ActionCandidate,
  ActionListQuery,
  buildSourceEventId,
  DEADLINE_WINDOW_DAYS,
  ENGAGEMENT_LOOKBACK_DAYS,
  OPPORTUNITY_SCORE_THRESHOLD,
  OPTIMIZATION_SCORE_THRESHOLD,
  PRIORITY_VERSION_V2,
  RECOMMENDATION_FETCH_LIMIT,
  UserActionDto,
  UserActionListResponse,
} from './action.types';

type ActionContext = Awaited<ReturnType<ActionService['loadContext']>>;

@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ActionScoringService,
    private readonly expiration: ActionExpirationService,
  ) {}

  scheduleRegenerate(userId: string): void {
    this.regenerateForUser(userId).catch((err) => {
      this.logger.warn(
        `Action regenerate failed for user ${userId}: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  async findForUser(
    userId: string,
    query: ActionListQuery = {},
  ): Promise<UserActionListResponse> {
    const status = query.status ?? UserActionStatus.OPEN;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const offset = Math.max(query.offset ?? 0, 0);
    const sort = query.sort ?? 'priority_score';

    const where = {
      userId,
      status,
      ...(query.type ? { type: query.type } : {}),
    };

    let total = await this.prisma.userAction.count({ where });

    if (status === UserActionStatus.OPEN && total === 0) {
      await this.runRegeneratePipeline(userId);
      total = await this.prisma.userAction.count({ where });
    }

    const orderBy =
      sort === 'createdAt'
        ? [{ createdAt: 'asc' as const }]
        : [{ priorityScore: 'desc' as const }, { createdAt: 'asc' as const }];

    const rows = await this.prisma.userAction.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
    });

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      limit,
      offset,
    };
  }

  async findOpenForUser(userId: string, limit: number): Promise<UserActionDto[]> {
    const result = await this.findForUser(userId, {
      status: UserActionStatus.OPEN,
      limit,
      offset: 0,
      sort: 'priority_score',
    });
    return result.items;
  }

  async findOpenForUserWithLazyRegenerate(
    userId: string,
    limit: number,
  ): Promise<UserActionDto[]> {
    return this.findOpenForUser(userId, limit);
  }

  async regenerateForUser(
    userId: string,
    limit = 5,
  ): Promise<UserActionDto[]> {
    await this.runRegeneratePipeline(userId);
    return this.fetchOpenDtos(userId, limit);
  }

  private async runRegeneratePipeline(userId: string): Promise<void> {
    const context = await this.loadContext(userId);
    const expirationContext = this.expiration.buildContextFromActionContext(context);
    await this.expiration.expireOpenActions(userId, expirationContext);

    const candidates = this.buildCandidates(context);
    const sorted = this.scoring.sortCandidates(candidates);
    await this.upsertCandidates(userId, sorted);
    await this.dismissStaleOpen(userId, sorted);
  }

  private async fetchOpenDtos(
    userId: string,
    limit: number,
  ): Promise<UserActionDto[]> {
    const rows = await this.prisma.userAction.findMany({
      where: { userId, status: UserActionStatus.OPEN },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return rows.map((row) => this.toDto(row));
  }

  async reconcileAllStudents(): Promise<{ users: number }> {
    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: { id: true },
    });
    for (const student of students) {
      await this.regenerateForUser(student.id);
    }
    return { users: students.length };
  }

  async updateStatus(
    userId: string,
    actionId: string,
    status: 'DONE' | 'DISMISSED',
  ): Promise<UserActionDto> {
    const existing = await this.prisma.userAction.findFirst({
      where: { id: actionId, userId },
    });
    if (!existing) {
      throw new NotFoundException('פעולה לא נמצאה');
    }

    const updated = await this.prisma.userAction.update({
      where: { id: actionId },
      data: { status: status as UserActionStatus },
    });
    return this.toDto(updated);
  }

  async loadContext(userId: string) {
    const now = new Date();
    const engagementSince = new Date(now);
    engagementSince.setDate(engagementSince.getDate() - ENGAGEMENT_LOOKBACK_DAYS);

    const [profile, applications, recommendations, events] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.prisma.application.findMany({
        where: { userId },
        include: { scholarship: true },
      }),
      this.prisma.recommendation.findMany({
        where: { userId },
        include: { scholarship: true },
        orderBy: { score: 'desc' },
        take: RECOMMENDATION_FETCH_LIMIT,
      }),
      this.prisma.scholarshipEvent.findMany({
        where: { userId, createdAt: { gte: engagementSince } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const applicationScholarshipIds = new Set(
      applications.map((a) => a.scholarshipId),
    );

    const viewsByScholarship = new Map<string, Date>();
    const applyStarts = new Set<string>();
    for (const event of events) {
      if (event.eventType === 'VIEW') {
        if (!viewsByScholarship.has(event.scholarshipId)) {
          viewsByScholarship.set(event.scholarshipId, event.createdAt);
        }
      }
      if (event.eventType === 'APPLY_START') {
        applyStarts.add(event.scholarshipId);
      }
    }

    const engagementScholarshipIds = [...viewsByScholarship.keys()].filter(
      (id) => !applicationScholarshipIds.has(id) && !applyStarts.has(id),
    );

    const engagementScholarships =
      engagementScholarshipIds.length > 0
        ? await this.prisma.scholarship.findMany({
            where: { id: { in: engagementScholarshipIds } },
            select: { id: true, title: true, deadline: true },
          })
        : [];

    return {
      userId,
      now,
      profile,
      applications,
      recommendations,
      applicationScholarshipIds,
      viewsByScholarship,
      applyStarts,
      engagementScholarships,
    };
  }

  buildCandidates(context: ActionContext): ActionCandidate[] {
    const candidates: ActionCandidate[] = [];
    candidates.push(...this.buildCompletionActions(context));
    candidates.push(...this.buildDeadlineActions(context));
    candidates.push(...this.buildScholarshipDiscoveryActions(context));
    return candidates.map((candidate) => ({
      ...candidate,
      priorityScore: this.scoring.computePriorityScore(candidate.scoreInput),
    }));
  }

  private buildCompletionActions(context: ActionContext): ActionCandidate[] {
    const profile = context.profile;
    const missingFields = [
      !profile?.fieldOfStudy,
      profile?.year == null,
      profile?.gpa == null,
    ].filter(Boolean).length;

    if (missingFields === 0) return [];

    const scoreInput = {
      type: UserActionType.COMPLETION_ACTION,
      missingProfileFields: missingFields,
    };

    return [
      {
        type: UserActionType.COMPLETION_ACTION,
        title: 'השלם/י את הפרופיל האקדמי שלך',
        description:
          'הוספת תחום לימודים, שנת לימודים וממוצע מאפשרת המלצות מדויקות ופעולות מותאמות.',
        priorityScore: 0,
        relatedEntityType: RelatedEntityType.PROFILE,
        relatedEntityId: context.userId,
        ctaPath: '/profile',
        signalHash: `profile:${missingFields}:${profile?.fieldOfStudy ?? ''}:${profile?.year ?? ''}:${profile?.gpa ?? ''}`,
        scoreInput,
      },
    ];
  }

  private buildDeadlineActions(context: ActionContext): ActionCandidate[] {
    const results: ActionCandidate[] = [];

    for (const app of context.applications) {
      if (
        app.status !== ApplicationStatus.NOT_STARTED &&
        app.status !== ApplicationStatus.IN_PROGRESS
      ) {
        continue;
      }

      const deadline = app.scholarship.deadline;
      if (!deadline || !this.isDeadlineOpen(deadline, context.now)) continue;

      const daysLeft = this.daysLeft(deadline, context.now);
      if (daysLeft > DEADLINE_WINDOW_DAYS) continue;

      const hasLetter = Boolean(app.motivationLetter?.trim());
      if (hasLetter && app.status === ApplicationStatus.IN_PROGRESS) continue;

      const scoreInput = {
        type: UserActionType.DEADLINE_ACTION,
        daysLeft,
        hasLetter,
        applicationStatus: app.status,
      };

      results.push({
        type: UserActionType.DEADLINE_ACTION,
        title: `השלם/י את הבקשה ל${app.scholarship.title} — נותרו ${daysLeft} ימים`,
        description: `המועד האחרון להגשה מתקרב. ${hasLetter ? 'עדכן/י את הבקשה והגש/י בזמן.' : 'יש להשלים מכתב מוטיבציה ולהגיש את הבקשה.'}`,
        priorityScore: 0,
        relatedEntityType: RelatedEntityType.APPLICATION,
        relatedEntityId: app.id,
        ctaPath: `/applications/${app.id}`,
        signalHash: `deadline:${app.id}:${deadline.toISOString()}:${app.status}:${hasLetter}`,
        scoreInput,
      });
    }

    return results;
  }

  private buildScholarshipDiscoveryActions(
    context: ActionContext,
  ): ActionCandidate[] {
    if (!this.isProfileCompleteForRecommendations(context.profile)) {
      return [];
    }

    const results: ActionCandidate[] = [];
    const emittedScholarships = new Set<string>();

    for (const rec of context.recommendations) {
      if (context.applicationScholarshipIds.has(rec.scholarshipId)) continue;
      if (!this.isDeadlineOpen(rec.scholarship.deadline, context.now)) continue;
      if (rec.score < OPPORTUNITY_SCORE_THRESHOLD) continue;

      const hasRecentView = context.viewsByScholarship.has(rec.scholarshipId);
      const scoreInput = {
        type: UserActionType.OPPORTUNITY_ACTION,
        recommendationScore: rec.score,
        hasRecentView,
      };

      results.push({
        type: UserActionType.OPPORTUNITY_ACTION,
        title: `הזדמנות מומלצת: ${rec.scholarship.title} (ציון ${Math.round(rec.score)})`,
        description:
          rec.matchReason ??
          'מלגה בעלת התאמה גבוהה — התחל/י בקשה כדי לא לפספס.',
        priorityScore: 0,
        relatedEntityType: RelatedEntityType.SCHOLARSHIP,
        relatedEntityId: rec.scholarshipId,
        ctaPath: `/scholarships/${rec.scholarshipId}`,
        signalHash: `opp:${rec.scholarshipId}:${Math.round(rec.score)}`,
        scoreInput,
      });
      emittedScholarships.add(rec.scholarshipId);
    }

    for (const rec of context.recommendations) {
      if (emittedScholarships.has(rec.scholarshipId)) continue;
      if (context.applicationScholarshipIds.has(rec.scholarshipId)) continue;
      if (!this.isDeadlineOpen(rec.scholarship.deadline, context.now)) continue;
      if (rec.score < OPTIMIZATION_SCORE_THRESHOLD) continue;
      if (rec.score >= OPPORTUNITY_SCORE_THRESHOLD) continue;

      const hasRecentView = context.viewsByScholarship.has(rec.scholarshipId);
      const scoreInput = {
        type: UserActionType.OPTIMIZATION_ACTION,
        recommendationScore: rec.score,
        hasRecentView,
      };

      results.push({
        type: UserActionType.OPTIMIZATION_ACTION,
        title: `מלגה מומלצת: ${rec.scholarship.title} (ציון ${Math.round(rec.score)})`,
        description:
          rec.matchReason ??
          'מלגה שמתאימה לפרופיל שלך — התחל/י בקשה כדי לא לפספס.',
        priorityScore: 0,
        relatedEntityType: RelatedEntityType.SCHOLARSHIP,
        relatedEntityId: rec.scholarshipId,
        ctaPath: `/scholarships/${rec.scholarshipId}`,
        signalHash: `opt:${rec.scholarshipId}:${Math.round(rec.score)}`,
        scoreInput,
      });
      emittedScholarships.add(rec.scholarshipId);
    }

    for (const scholarship of context.engagementScholarships) {
      if (emittedScholarships.has(scholarship.id)) continue;
      if (!this.isDeadlineOpen(scholarship.deadline, context.now)) continue;

      const scoreInput = {
        type: UserActionType.ENGAGEMENT_ACTION,
        hasRecentView: true,
        hasApplyStart: false,
      };

      results.push({
        type: UserActionType.ENGAGEMENT_ACTION,
        title: `המשך/י לבדוק: ${scholarship.title}`,
        description: 'צפית במלגה זו — התחל/י בקשה או שמור/י לרשימת המעקב.',
        priorityScore: 0,
        relatedEntityType: RelatedEntityType.SCHOLARSHIP,
        relatedEntityId: scholarship.id,
        ctaPath: `/scholarships/${scholarship.id}`,
        signalHash: `engage:${scholarship.id}:${context.viewsByScholarship.get(scholarship.id)?.toISOString() ?? ''}`,
        scoreInput,
      });
    }

    return results;
  }

  private async upsertCandidates(
    userId: string,
    candidates: ActionCandidate[],
  ): Promise<void> {
    for (const candidate of candidates) {
      const existing = await this.prisma.userAction.findFirst({
        where: {
          userId,
          type: candidate.type,
          relatedEntityType: candidate.relatedEntityType,
          relatedEntityId: candidate.relatedEntityId,
        },
      });

      const metadata = { signalHash: candidate.signalHash };
      const sourceEventId = buildSourceEventId(candidate);

      if (existing) {
        if (existing.status === UserActionStatus.EXPIRED) continue;

        if (
          existing.status === UserActionStatus.DISMISSED ||
          existing.status === UserActionStatus.DONE
        ) {
          const prevHash =
            typeof existing.metadata === 'object' &&
            existing.metadata !== null &&
            'signalHash' in existing.metadata
              ? String((existing.metadata as { signalHash: string }).signalHash)
              : '';
          if (prevHash === candidate.signalHash) continue;
          await this.prisma.userAction.delete({ where: { id: existing.id } });
        } else if (existing.status === UserActionStatus.OPEN) {
          await this.prisma.userAction.update({
            where: { id: existing.id },
            data: {
              title: candidate.title,
              description: candidate.description,
              priorityScore: candidate.priorityScore,
              ctaPath: candidate.ctaPath,
              metadata,
              sourceEventId,
              priorityVersion: PRIORITY_VERSION_V2,
            },
          });
          continue;
        }
      }

      await this.prisma.userAction.create({
        data: {
          userId,
          type: candidate.type,
          title: candidate.title,
          description: candidate.description,
          priorityScore: candidate.priorityScore,
          status: UserActionStatus.OPEN,
          relatedEntityType: candidate.relatedEntityType,
          relatedEntityId: candidate.relatedEntityId,
          ctaPath: candidate.ctaPath,
          metadata,
          sourceEventId,
          priorityVersion: PRIORITY_VERSION_V2,
        },
      });
    }
  }

  private async dismissStaleOpen(
    userId: string,
    candidates: ActionCandidate[],
  ): Promise<void> {
    const activeKeys = new Set(
      candidates.map(
        (c) => `${c.type}:${c.relatedEntityType}:${c.relatedEntityId}`,
      ),
    );

    const openRows = await this.prisma.userAction.findMany({
      where: { userId, status: UserActionStatus.OPEN },
    });

    for (const row of openRows) {
      const key = `${row.type}:${row.relatedEntityType}:${row.relatedEntityId}`;
      if (!activeKeys.has(key)) {
        await this.prisma.userAction.update({
          where: { id: row.id },
          data: { status: UserActionStatus.DISMISSED },
        });
      }
    }
  }

  private isProfileCompleteForRecommendations(
    profile: ActionContext['profile'],
  ): boolean {
    if (!profile) return false;
    return (
      Boolean(profile.fieldOfStudy) &&
      profile.year != null &&
      profile.gpa != null
    );
  }

  private isDeadlineOpen(deadline: Date | null | undefined, now: Date): boolean {
    if (!deadline) return true;
    return deadline.getTime() > now.getTime();
  }

  private daysLeft(deadline: Date, now: Date): number {
    const ms = deadline.getTime() - now.getTime();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  private toDto(row: {
    id: string;
    type: UserActionType;
    title: string;
    description: string;
    priorityScore: number;
    status: UserActionStatus;
    relatedEntityType: RelatedEntityType | null;
    relatedEntityId: string | null;
    ctaPath: string | null;
    sourceEventId: string | null;
    priorityVersion: string;
    expiredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserActionDto {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      priorityScore: row.priorityScore,
      status: row.status,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      ctaPath: row.ctaPath,
      sourceEventId: row.sourceEventId,
      priorityVersion: row.priorityVersion,
      expiredAt: row.expiredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
