import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ApplicationStatus,
  NotificationType,
  Role,
} from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import { STATUS_LABELS } from '../application/application-state.machine';
import { MailService } from './mail.service';

const DEADLINE_WINDOW_DAYS = 7;
const ACTIVE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.NOT_STARTED,
  ApplicationStatus.IN_PROGRESS,
];

const EMAIL_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.DEADLINE_APPROACHING,
  NotificationType.APPLICATION_STATUS,
];

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findAllForUser(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      include: {
        scholarship: { select: { id: true, title: true, deadline: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((n) => this.toItem(n));
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      include: {
        scholarship: { select: { id: true, title: true, deadline: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('התראה לא נמצאה');
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      include: {
        scholarship: { select: { id: true, title: true, deadline: true } },
      },
    });
    return this.toItem(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async syncDeadlineNotifications(userId: string): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + DEADLINE_WINDOW_DAYS);

    const applications = await this.prisma.application.findMany({
      where: {
        userId,
        status: { in: ACTIVE_STATUSES },
        scholarship: {
          deadline: { gt: now, lte: windowEnd },
        },
      },
      include: { scholarship: true },
    });

    let created = 0;
    for (const app of applications) {
      const scholarship = app.scholarship;
      if (!scholarship.deadline) continue;

      const deadlineStr = scholarship.deadline.toLocaleDateString('he-IL');
      const statusLabel = STATUS_LABELS[app.status];

      const row = await this.createNotificationAndMaybeEmail({
        userId,
        type: NotificationType.DEADLINE_APPROACHING,
        title: `מועד אחרון מתקרב: ${scholarship.title}`,
        body: `המועד האחרון להגשה הוא ${deadlineStr}. סטטוס הבקשה: ${statusLabel}.`,
        scholarshipId: scholarship.id,
        applicationId: app.id,
      });
      if (row) created++;
    }
    return created;
  }

  async syncDeadlineNotificationsForAllStudents(): Promise<number> {
    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: { id: true },
    });
    let total = 0;
    for (const student of students) {
      total += await this.syncDeadlineNotifications(student.id);
    }
    return total;
  }

  async createApplicationStatusNotification(application: {
    id: string;
    userId: string;
    scholarshipId: string;
    scholarship: { title: string };
  }) {
    const row = await this.createNotificationAndMaybeEmail({
      userId: application.userId,
      type: NotificationType.APPLICATION_STATUS,
      title: 'הבקשה סומנה כהוגשה',
      body: `הבקשה למלגה "${application.scholarship.title}" סומנה כהוגשה.`,
      scholarshipId: application.scholarshipId,
      applicationId: application.id,
    });
    if (!row) {
      this.logger.warn(
        `Status notification skipped (duplicate) for application ${application.id}`,
      );
    }
  }

  private async createNotificationAndMaybeEmail(
    data: Prisma.NotificationUncheckedCreateInput,
  ) {
    try {
      const row = await this.prisma.notification.create({ data });
      await this.maybeSendEmail(row.id);
      return row;
    } catch {
      if (
        data.userId &&
        data.type &&
        data.applicationId != null &&
        data.applicationId !== ''
      ) {
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: data.userId,
            type: data.type,
            applicationId: data.applicationId,
          },
        });
        if (existing) {
          await this.maybeSendEmail(existing.id);
          return existing;
        }
      }
      return null;
    }
  }

  async maybeSendEmail(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: { email: true, emailNotificationsEnabled: true },
        },
      },
    });
    if (!notification) return;
    if (!EMAIL_NOTIFICATION_TYPES.includes(notification.type)) return;
    if (notification.emailSentAt) return;
    if (!notification.user.emailNotificationsEnabled) return;

    const ok = await this.mailService.send({
      userId: notification.userId,
      to: notification.user.email,
      subject: notification.title,
      text: notification.body,
    });

    if (ok) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { emailSentAt: new Date() },
      });
    } else {
      this.logger.warn(
        `Email not sent for notification ${notificationId} (user ${this.maskUserEmail(notification.user.email)}). Check MAIL_* env, Resend dashboard, or set MAIL_OVERRIDE_TO for sandbox.`,
      );
    }
  }

  private maskUserEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local[0]}***@${domain}`;
  }

  private toItem(row: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    readAt: Date | null;
    scholarshipId: string | null;
    applicationId: string | null;
    createdAt: Date;
    scholarship?: { id: string; title: string; deadline: Date | null } | null;
  }) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      readAt: row.readAt?.toISOString() ?? null,
      scholarshipId: row.scholarshipId,
      applicationId: row.applicationId,
      createdAt: row.createdAt.toISOString(),
      scholarship: row.scholarship
        ? {
            id: row.scholarship.id,
            title: row.scholarship.title,
            deadline: row.scholarship.deadline?.toISOString() ?? null,
          }
        : undefined,
    };
  }
}
