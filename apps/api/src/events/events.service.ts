import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ScholarshipEventType } from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import { ActionService } from '../action/action.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly actionService: ActionService,
  ) {}

  async recordEvent(
    userId: string,
    scholarshipId: string,
    eventType: ScholarshipEventType,
  ) {
    const scholarship = await this.prisma.scholarship.findUnique({
      where: { id: scholarshipId },
    });
    if (!scholarship) {
      throw new NotFoundException('מלגה לא נמצאה');
    }

    await this.prisma.scholarshipEvent.create({
      data: { userId, scholarshipId, eventType },
    });

    this.actionService.scheduleRegenerate(userId);

    return { ok: true };
  }

  async recordApplyStartSafe(userId: string, scholarshipId: string) {
    try {
      await this.recordEvent(userId, scholarshipId, ScholarshipEventType.APPLY_START);
    } catch (err) {
      this.logger.warn(
        `Failed to record APPLY_START: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
