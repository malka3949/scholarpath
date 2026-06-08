import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@Req() req: { user: { sub: string } }) {
    return this.notificationService.findAllForUser(req.user.sub);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: { sub: string } }) {
    return this.notificationService.getUnreadCount(req.user.sub);
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: { sub: string } }) {
    return this.notificationService.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.notificationService.markRead(req.user.sub, id);
  }

  @Post('sync-deadlines')
  syncDeadlines(@Req() req: { user: { sub: string } }) {
    return this.notificationService
      .syncDeadlineNotifications(req.user.sub)
      .then((created) => ({ created }));
  }
}
