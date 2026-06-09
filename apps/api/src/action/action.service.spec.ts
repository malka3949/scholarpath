import { NotFoundException } from '@nestjs/common';
import {
  ApplicationStatus,
  RelatedEntityType,
  UserActionStatus,
  UserActionType,
} from '@scholarpath/database';
import { ActionService } from './action.service';
import { ActionScoringService } from './action-scoring.service';
import { ActionExpirationService } from './action-expiration.service';
import { PrismaService } from '../prisma/prisma.module';

describe('ActionService', () => {
  let service: ActionService;
  let expiration: {
    expireOpenActions: jest.Mock;
    buildContextFromActionContext: jest.Mock;
  };
  let prisma: {
    studentProfile: { findUnique: jest.Mock };
    application: { findMany: jest.Mock };
    recommendation: { findMany: jest.Mock };
    scholarshipEvent: { findMany: jest.Mock };
    scholarship: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    userAction: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  const now = new Date('2026-06-08T12:00:00.000Z');

  beforeEach(() => {
    expiration = {
      expireOpenActions: jest.fn().mockResolvedValue(0),
      buildContextFromActionContext: jest.fn().mockReturnValue({}),
    };
    prisma = {
      studentProfile: { findUnique: jest.fn() },
      application: { findMany: jest.fn() },
      recommendation: { findMany: jest.fn() },
      scholarshipEvent: { findMany: jest.fn() },
      scholarship: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      userAction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new ActionService(
      prisma as unknown as PrismaService,
      new ActionScoringService(),
      expiration as unknown as ActionExpirationService,
    );
  });

  it('buildCandidates includes COMPLETION_ACTION when profile incomplete', () => {
    const context = {
      userId: 'u1',
      now,
      profile: { fieldOfStudy: null, year: 2, gpa: 90 },
      applications: [],
      recommendations: [],
      applicationScholarshipIds: new Set<string>(),
      viewsByScholarship: new Map(),
      applyStarts: new Set<string>(),
      engagementScholarships: [],
    };

    const candidates = service.buildCandidates(context as never);
    expect(candidates.some((c) => c.type === UserActionType.COMPLETION_ACTION)).toBe(
      true,
    );
  });

  it('buildCandidates includes DEADLINE_ACTION for near deadline app', () => {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 4);

    const context = {
      userId: 'u1',
      now,
      profile: { fieldOfStudy: 'CS', year: 2, gpa: 90 },
      applications: [
        {
          id: 'app1',
          scholarshipId: 's1',
          status: ApplicationStatus.IN_PROGRESS,
          motivationLetter: '',
          scholarship: { id: 's1', title: 'מלגה', deadline },
        },
      ],
      recommendations: [],
      applicationScholarshipIds: new Set(['s1']),
      viewsByScholarship: new Map(),
      applyStarts: new Set(['s1']),
      engagementScholarships: [],
    };

    const candidates = service.buildCandidates(context as never);
    expect(candidates.some((c) => c.type === UserActionType.DEADLINE_ACTION)).toBe(
      true,
    );
  });

  it('buildCandidates prefers OPPORTUNITY over OPTIMIZATION for score 82', () => {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 30);

    const context = {
      userId: 'u1',
      now,
      profile: { fieldOfStudy: 'CS', year: 2, gpa: 90 },
      applications: [],
      recommendations: [
        {
          scholarshipId: 's1',
          score: 82,
          matchReason: 'התאמה גבוהה',
          scholarship: { id: 's1', title: 'מלגה', deadline },
        },
      ],
      applicationScholarshipIds: new Set<string>(),
      viewsByScholarship: new Map(),
      applyStarts: new Set<string>(),
      engagementScholarships: [],
    };

    const candidates = service.buildCandidates(context as never);
    expect(candidates.some((c) => c.type === UserActionType.OPPORTUNITY_ACTION)).toBe(
      true,
    );
    expect(candidates.some((c) => c.type === UserActionType.OPTIMIZATION_ACTION)).toBe(
      false,
    );
  });

  it('buildCandidates uses OPTIMIZATION for score 75', () => {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 30);

    const context = {
      userId: 'u1',
      now,
      profile: { fieldOfStudy: 'CS', year: 2, gpa: 90 },
      applications: [],
      recommendations: [
        {
          scholarshipId: 's1',
          score: 75,
          matchReason: null,
          scholarship: { id: 's1', title: 'מלגה', deadline },
        },
      ],
      applicationScholarshipIds: new Set<string>(),
      viewsByScholarship: new Map(),
      applyStarts: new Set<string>(),
      engagementScholarships: [],
    };

    const candidates = service.buildCandidates(context as never);
    expect(candidates.some((c) => c.type === UserActionType.OPTIMIZATION_ACTION)).toBe(
      true,
    );
    expect(candidates.some((c) => c.type === UserActionType.OPPORTUNITY_ACTION)).toBe(
      false,
    );
  });

  it('regenerate upserts OPEN actions idempotently', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({
      fieldOfStudy: null,
      year: 2,
      gpa: 90,
    });
    prisma.application.findMany.mockResolvedValue([]);
    prisma.recommendation.findMany.mockResolvedValue([]);
    prisma.scholarshipEvent.findMany.mockResolvedValue([]);
    prisma.scholarship.findMany.mockResolvedValue([]);
    prisma.userAction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'a1',
        status: UserActionStatus.OPEN,
        metadata: { signalHash: 'profile:1::2:90' },
      });
    prisma.userAction.create.mockResolvedValue({
      id: 'a1',
      type: UserActionType.COMPLETION_ACTION,
      title: 't',
      description: 'd',
      priorityScore: 10,
      status: UserActionStatus.OPEN,
      relatedEntityType: RelatedEntityType.PROFILE,
      relatedEntityId: 'u1',
      ctaPath: '/profile',
      sourceEventId: null,
      priorityVersion: 'priority-v2',
      expiredAt: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.userAction.update.mockResolvedValue({});
    const openRow = {
      id: 'a1',
      type: UserActionType.COMPLETION_ACTION,
      title: 't',
      description: 'd',
      priorityScore: 10,
      status: UserActionStatus.OPEN,
      relatedEntityType: RelatedEntityType.PROFILE,
      relatedEntityId: 'u1',
      ctaPath: '/profile',
      sourceEventId: null,
      priorityVersion: 'priority-v2',
      expiredAt: null,
      createdAt: now,
      updatedAt: now,
    };
    prisma.userAction.count.mockResolvedValue(1);
    prisma.userAction.findMany.mockImplementation(() =>
      Promise.resolve([openRow]),
    );

    await service.regenerateForUser('u1');
    await service.regenerateForUser('u1');

    expect(expiration.expireOpenActions).toHaveBeenCalled();
    expect(prisma.userAction.create).toHaveBeenCalledTimes(1);
    expect(prisma.userAction.update).toHaveBeenCalled();
  });

  it('updateStatus throws when action not found', async () => {
    prisma.userAction.findFirst.mockResolvedValue(null);
    await expect(
      service.updateStatus('u1', 'missing', 'DISMISSED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('skips upsert for EXPIRED row', async () => {
    prisma.userAction.findFirst.mockResolvedValue({
      id: 'a1',
      status: UserActionStatus.EXPIRED,
      metadata: { signalHash: 'profile:1::2:90' },
    });

    const candidates = service.buildCandidates({
      userId: 'u1',
      now,
      profile: { fieldOfStudy: null, year: 2, gpa: 90 },
      applications: [],
      recommendations: [],
      applicationScholarshipIds: new Set(),
      viewsByScholarship: new Map(),
      applyStarts: new Set(),
      engagementScholarships: [],
    } as never);

    await (service as unknown as { upsertCandidates: (u: string, c: unknown[]) => Promise<void> }).upsertCandidates(
      'u1',
      candidates,
    );

    expect(prisma.userAction.update).not.toHaveBeenCalled();
    expect(prisma.userAction.create).not.toHaveBeenCalled();
  });
});
