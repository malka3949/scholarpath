import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  RelatedEntityType,
  UserActionStatus,
  UserActionType,
} from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import {
  ENGAGEMENT_TTL_DAYS,
  OPPORTUNITY_TTL_DAYS,
  OPTIMIZATION_TTL_DAYS,
} from './action.types';

type ExpirationContext = {
  now: Date;
  profile: {
    fieldOfStudy: string | null;
    year: number | null;
    gpa: number | null;
  } | null;
  applicationsById: Map<
    string,
    { scholarshipId: string; scholarship: { deadline: Date | null } }
  >;
  applicationScholarshipIds: Set<string>;
  scholarshipDeadlines: Map<string, Date | null>;
};

@Injectable()
export class ActionExpirationService {
  constructor(private readonly prisma: PrismaService) {}

  async expireOpenActions(
    userId: string,
    context: ExpirationContext,
  ): Promise<number> {
    const openRows = await this.prisma.userAction.findMany({
      where: { userId, status: UserActionStatus.OPEN },
    });

    let affected = 0;
    for (const row of openRows) {
      const resolution = this.resolveRow(row, context);
      if (resolution === 'NONE') continue;

      if (resolution === 'DONE') {
        await this.prisma.userAction.update({
          where: { id: row.id },
          data: { status: UserActionStatus.DONE },
        });
        affected++;
        continue;
      }

      await this.prisma.userAction.update({
        where: { id: row.id },
        data: {
          status: UserActionStatus.EXPIRED,
          expiredAt: context.now,
        },
      });
      affected++;
    }

    return affected;
  }

  buildContextFromActionContext(context: {
    now: Date;
    profile: ExpirationContext['profile'];
    applications: Array<{
      id: string;
      scholarshipId: string;
      scholarship: { deadline: Date | null };
    }>;
    applicationScholarshipIds: Set<string>;
    recommendations: Array<{
      scholarshipId: string;
      scholarship: { deadline: Date | null };
    }>;
  }): ExpirationContext {
    const applicationsById = new Map(
      context.applications.map((app) => [app.id, app]),
    );
    const scholarshipDeadlines = new Map<string, Date | null>();
    for (const rec of context.recommendations) {
      scholarshipDeadlines.set(rec.scholarshipId, rec.scholarship.deadline);
    }
    for (const app of context.applications) {
      scholarshipDeadlines.set(app.scholarshipId, app.scholarship.deadline);
    }

    return {
      now: context.now,
      profile: context.profile,
      applicationsById,
      applicationScholarshipIds: context.applicationScholarshipIds,
      scholarshipDeadlines,
    };
  }

  private resolveRow(
    row: {
      type: UserActionType;
      relatedEntityType: RelatedEntityType | null;
      relatedEntityId: string | null;
      createdAt: Date;
    },
    context: ExpirationContext,
  ): 'NONE' | 'EXPIRED' | 'DONE' {
    if (row.type === UserActionType.COMPLETION_ACTION) {
      if (this.isProfileComplete(context.profile)) return 'DONE';
      return 'NONE';
    }

    if (row.type === UserActionType.DEADLINE_ACTION) {
      const app =
        row.relatedEntityId != null
          ? context.applicationsById.get(row.relatedEntityId)
          : undefined;
      const deadline = app?.scholarship.deadline;
      if (deadline && deadline.getTime() < context.now.getTime()) {
        return 'EXPIRED';
      }
      return 'NONE';
    }

    if (
      row.type === UserActionType.OPPORTUNITY_ACTION ||
      row.type === UserActionType.OPTIMIZATION_ACTION ||
      row.type === UserActionType.ENGAGEMENT_ACTION
    ) {
      const scholarshipId = row.relatedEntityId ?? undefined;
      if (scholarshipId) {
        if (context.applicationScholarshipIds.has(scholarshipId)) {
          return 'EXPIRED';
        }
        const deadline = context.scholarshipDeadlines.get(scholarshipId);
        if (deadline && deadline.getTime() < context.now.getTime()) {
          return 'EXPIRED';
        }
      }

      if (row.type === UserActionType.OPTIMIZATION_ACTION) {
        if (this.isOlderThanDays(row.createdAt, context.now, OPTIMIZATION_TTL_DAYS)) {
          return 'EXPIRED';
        }
        return 'NONE';
      }

      if (row.type === UserActionType.OPPORTUNITY_ACTION) {
        if (this.isOlderThanDays(row.createdAt, context.now, OPPORTUNITY_TTL_DAYS)) {
          return 'EXPIRED';
        }
        return 'NONE';
      }

      if (row.type === UserActionType.ENGAGEMENT_ACTION) {
        if (this.isOlderThanDays(row.createdAt, context.now, ENGAGEMENT_TTL_DAYS)) {
          return 'EXPIRED';
        }
      }
    }

    return 'NONE';
  }

  private isProfileComplete(
    profile: ExpirationContext['profile'],
  ): boolean {
    if (!profile) return false;
    return (
      Boolean(profile.fieldOfStudy) &&
      profile.year != null &&
      profile.gpa != null
    );
  }

  private isOlderThanDays(
    createdAt: Date,
    now: Date,
    days: number,
  ): boolean {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return createdAt.getTime() < cutoff.getTime();
  }
}
