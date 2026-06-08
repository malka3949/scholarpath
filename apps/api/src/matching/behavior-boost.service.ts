import { Injectable } from '@nestjs/common';
import { ScholarshipEventType } from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';

const WINDOW_DAYS = 14;
const VIEW_BOOST = 3;
const APPLY_BOOST = 8;
const MAX_BOOST = 15;

@Injectable()
export class BehaviorBoostService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateBoost(userId: string, scholarshipId: string): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);

    const events = await this.prisma.scholarshipEvent.findMany({
      where: {
        userId,
        scholarshipId,
        createdAt: { gte: since },
      },
    });

    let boost = 0;
    const hasView = events.some((e) => e.eventType === ScholarshipEventType.VIEW);
    const hasApply = events.some(
      (e) => e.eventType === ScholarshipEventType.APPLY_START,
    );

    if (hasView) boost += VIEW_BOOST;
    if (hasApply) boost += APPLY_BOOST;

    return Math.min(boost, MAX_BOOST);
  }
}
