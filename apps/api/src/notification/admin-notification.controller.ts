import { Controller, Post, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('sync-deadlines')
  async syncAll() {
    const created =
      await this.notificationService.syncDeadlineNotificationsForAllStudents();
    return { created };
  }
}
