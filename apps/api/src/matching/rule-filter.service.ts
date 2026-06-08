import { Injectable } from '@nestjs/common';
import { Scholarship, StudentProfile } from '@prisma/client';

export type EligibilityRules = {
  field_of_study?: string;
  min_gpa?: number;
  min_year?: number;
  max_year?: number;
};

export type RuleMatchResult = {
  scholarship: Scholarship;
  ruleScore: number;
  ruleReason: string;
};

@Injectable()
export class RuleFilterService {
  parseRules(raw: unknown): EligibilityRules {
    if (!raw || typeof raw !== 'object') return {};
    return raw as EligibilityRules;
  }

  passesHardFilters(profile: StudentProfile, scholarship: Scholarship): boolean {
    const rules = this.parseRules(scholarship.eligibilityRules);

    if (rules.field_of_study && profile.fieldOfStudy) {
      if (rules.field_of_study !== profile.fieldOfStudy) return false;
    }

    if (profile.year != null) {
      if (rules.min_year != null && profile.year < rules.min_year) return false;
      if (rules.max_year != null && profile.year > rules.max_year) return false;
    }

    if (rules.min_gpa != null && profile.gpa != null) {
      if (profile.gpa < rules.min_gpa) return false;
    }

    return true;
  }

  scoreScholarship(profile: StudentProfile, scholarship: Scholarship): RuleMatchResult {
    const rules = this.parseRules(scholarship.eligibilityRules);
    let score = 40;
    const reasons: string[] = [];

    if (rules.field_of_study && profile.fieldOfStudy === rules.field_of_study) {
      score += 25;
      reasons.push('תואם לתחום הלימודים');
    }

    if (profile.gpa != null && rules.min_gpa != null) {
      const margin = profile.gpa - rules.min_gpa;
      if (margin >= 10) {
        score += 15;
        reasons.push('ממוצע גבוה מהדרישה');
      } else if (margin >= 0) {
        score += 8;
        reasons.push('עומד בדרישת הממוצע');
      }
    }

    if (profile.year != null && rules.min_year != null && rules.max_year != null) {
      const mid = (rules.min_year + rules.max_year) / 2;
      const yearDistance = Math.abs(profile.year - mid);
      if (yearDistance <= 0.5) {
        score += 10;
        reasons.push('שנת לימודים מתאימה');
      }
    }

    if (scholarship.deadline) {
      const daysLeft =
        (scholarship.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft > 0 && daysLeft <= 30) {
        score += 5;
        reasons.push('מועד אחרון קרוב');
      }
    }

    if (scholarship.tags.length > 0) {
      score += Math.min(scholarship.tags.length * 2, 10);
    }

    return {
      scholarship,
      ruleScore: Math.min(Math.round(score), 100),
      ruleReason: reasons.length > 0 ? reasons.join(' · ') : 'עומד בקריטריונים בסיסיים',
    };
  }

  filterAndScore(
    profile: StudentProfile,
    scholarships: Scholarship[],
  ): RuleMatchResult[] {
    return scholarships
      .filter((s) => this.passesHardFilters(profile, s))
      .map((s) => this.scoreScholarship(profile, s))
      .sort((a, b) => b.ruleScore - a.ruleScore);
  }
}
