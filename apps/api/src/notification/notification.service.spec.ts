import { NotFoundException } from '@nestjs/common';
import {
  ApplicationStatus,
  NotificationType,
} from '@scholarpath/database';
import { NotificationService } from './notification.service';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.module';

describe('NotificationService', () => {
  let service: NotificationService;
  let mailService: { send: jest.Mock; isEnabled: jest.Mock };
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    application: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(() => {
    mailService = {
      send: jest.fn().mockResolvedValue(true),
      isEnabled: jest.fn().mockReturnValue(true),
    };
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      application: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    service = new NotificationService(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
    );
  });

  it('syncDeadlineNotifications creates notification when deadline in window', async () => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);

    prisma.application.findMany.mockResolvedValue([
      {
        id: 'app1',
        userId: 'u1',
        status: ApplicationStatus.IN_PROGRESS,
        scholarship: {
          id: 's1',
          title: 'מלגת בדיקה',
          deadline,
        },
      },
    ]);
    prisma.notification.create.mockResolvedValue({ id: 'n1' });
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      type: NotificationType.DEADLINE_APPROACHING,
      title: 't',
      body: 'b',
      emailSentAt: null,
      user: { email: 's@test.local', emailNotificationsEnabled: true },
    });
    prisma.notification.update.mockResolvedValue({});

    const created = await service.syncDeadlineNotifications('u1');

    expect(created).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.DEADLINE_APPROACHING,
          userId: 'u1',
          applicationId: 'app1',
        }),
      }),
    );
    expect(mailService.send).toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: { emailSentAt: expect.any(Date) },
      }),
    );
  });

  it('syncDeadlineNotifications does not duplicate on unique conflict', async () => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);

    prisma.application.findMany.mockResolvedValue([
      {
        id: 'app1',
        userId: 'u1',
        status: ApplicationStatus.NOT_STARTED,
        scholarship: { id: 's1', title: 'מלגה', deadline },
      },
    ]);
    prisma.notification.create.mockRejectedValue(new Error('unique'));

    const created = await service.syncDeadlineNotifications('u1');

    expect(created).toBe(0);
    expect(mailService.send).not.toHaveBeenCalled();
  });

  it('maybeSendEmail skips when emailNotificationsEnabled is false', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      type: NotificationType.DEADLINE_APPROACHING,
      title: 't',
      body: 'b',
      emailSentAt: null,
      user: { email: 's@test.local', emailNotificationsEnabled: false },
    });

    await service.maybeSendEmail('n1');

    expect(mailService.send).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('maybeSendEmail skips when emailSentAt already set', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      type: NotificationType.APPLICATION_STATUS,
      title: 't',
      body: 'b',
      emailSentAt: new Date(),
      user: { email: 's@test.local', emailNotificationsEnabled: true },
    });

    await service.maybeSendEmail('n1');

    expect(mailService.send).not.toHaveBeenCalled();
  });

  it('markRead sets readAt', async () => {
    const readAt = new Date();
    prisma.notification.findFirst.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      type: NotificationType.SYSTEM,
      title: 't',
      body: 'b',
      readAt: null,
      scholarshipId: null,
      applicationId: null,
      createdAt: new Date(),
      scholarship: null,
    });
    prisma.notification.update.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      type: NotificationType.SYSTEM,
      title: 't',
      body: 'b',
      readAt,
      scholarshipId: null,
      applicationId: null,
      createdAt: new Date(),
      scholarship: null,
    });

    const result = await service.markRead('u1', 'n1');

    expect(result.readAt).toBe(readAt.toISOString());
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { readAt: expect.any(Date) },
      }),
    );
  });

  it('markRead throws when notification not found', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('u1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
