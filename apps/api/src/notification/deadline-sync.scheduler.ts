import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class DeadlineSyncScheduler {
  private readonly logger = new Logger(DeadlineSyncScheduler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Cron(process.env.CRON_DEADLINE_SYNC ?? CronExpression.EVERY_DAY_AT_7AM)
  async handleDeadlineSync() {
    const created =
      await this.notificationService.syncDeadlineNotificationsForAllStudents();
    this.logger.log(`Scheduled deadline sync: ${created} notification(s) created`);
  }
}
