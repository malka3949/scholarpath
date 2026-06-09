import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { AdminNotificationController } from './admin-notification.controller';
import { MailService } from './mail.service';
import { DeadlineSyncScheduler } from './deadline-sync.scheduler';
import { ActionModule } from '../action/action.module';

@Module({
  imports: [ActionModule],
  controllers: [NotificationController, AdminNotificationController],
  providers: [MailService, NotificationService, DeadlineSyncScheduler],
  exports: [NotificationService, MailService],
})
export class NotificationModule {}
