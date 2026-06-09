import { UserActionStatus, UserActionType } from '@scholarpath/database';
import { ActionExpirationService } from './action-expiration.service';
import { PrismaService } from '../prisma/prisma.module';

describe('ActionExpirationService', () => {
  let service: ActionExpirationService;
  let prisma: {
    userAction: { findMany: jest.Mock; update: jest.Mock };
  };

  const now = new Date('2026-06-08T12:00:00.000Z');

  beforeEach(() => {
    prisma = {
      userAction: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ActionExpirationService(prisma as unknown as PrismaService);
  });

  it('expires DEADLINE_ACTION when scholarship deadline passed', async () => {
    const pastDeadline = new Date('2026-06-01T12:00:00.000Z');
    prisma.userAction.findMany.mockResolvedValue([
      {
        id: 'a1',
        type: UserActionType.DEADLINE_ACTION,
        relatedEntityType: 'APPLICATION',
        relatedEntityId: 'app1',
        createdAt: now,
      },
    ]);

    const count = await service.expireOpenActions('u1', {
      now,
      profile: null,
      applicationsById: new Map([
        [
          'app1',
          {
            scholarshipId: 's1',
            scholarship: { deadline: pastDeadline },
          },
        ],
      ]),
      applicationScholarshipIds: new Set(['s1']),
      scholarshipDeadlines: new Map([['s1', pastDeadline]]),
    });

    expect(count).toBe(1);
    expect(prisma.userAction.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: UserActionStatus.EXPIRED, expiredAt: now },
    });
  });

  it('marks COMPLETION_ACTION DONE when profile complete', async () => {
    prisma.userAction.findMany.mockResolvedValue([
      {
        id: 'a2',
        type: UserActionType.COMPLETION_ACTION,
        relatedEntityType: 'PROFILE',
        relatedEntityId: 'u1',
        createdAt: now,
      },
    ]);

    const count = await service.expireOpenActions('u1', {
      now,
      profile: { fieldOfStudy: 'CS', year: 2, gpa: 90 },
      applicationsById: new Map(),
      applicationScholarshipIds: new Set(),
      scholarshipDeadlines: new Map(),
    });

    expect(count).toBe(1);
    expect(prisma.userAction.update).toHaveBeenCalledWith({
      where: { id: 'a2' },
      data: { status: UserActionStatus.DONE },
    });
  });

  it('expires OPPORTUNITY_ACTION after 30 days', async () => {
    const old = new Date('2026-05-01T12:00:00.000Z');
    prisma.userAction.findMany.mockResolvedValue([
      {
        id: 'a3',
        type: UserActionType.OPPORTUNITY_ACTION,
        relatedEntityType: 'SCHOLARSHIP',
        relatedEntityId: 's1',
        createdAt: old,
      },
    ]);

    const count = await service.expireOpenActions('u1', {
      now,
      profile: null,
      applicationsById: new Map(),
      applicationScholarshipIds: new Set(),
      scholarshipDeadlines: new Map([['s1', null]]),
    });

    expect(count).toBe(1);
  });
});
