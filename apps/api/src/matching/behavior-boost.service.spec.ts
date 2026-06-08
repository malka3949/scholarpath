import { ScholarshipEventType } from '@scholarpath/database';
import { BehaviorBoostService } from './behavior-boost.service';
import { PrismaService } from '../prisma/prisma.module';

describe('BehaviorBoostService', () => {
  let service: BehaviorBoostService;
  let prisma: { scholarshipEvent: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { scholarshipEvent: { findMany: jest.fn() } };
    service = new BehaviorBoostService(prisma as unknown as PrismaService);
  });

  it('adds +3 for VIEW only', async () => {
    prisma.scholarshipEvent.findMany.mockResolvedValue([
      { eventType: ScholarshipEventType.VIEW },
    ]);
    expect(await service.calculateBoost('u1', 's1')).toBe(3);
  });

  it('adds +8 for APPLY_START only', async () => {
    prisma.scholarshipEvent.findMany.mockResolvedValue([
      { eventType: ScholarshipEventType.APPLY_START },
    ]);
    expect(await service.calculateBoost('u1', 's1')).toBe(8);
  });

  it('combines VIEW and APPLY_START (max 11, under cap 15)', async () => {
    prisma.scholarshipEvent.findMany.mockResolvedValue([
      { eventType: ScholarshipEventType.VIEW },
      { eventType: ScholarshipEventType.APPLY_START },
      { eventType: ScholarshipEventType.VIEW },
    ]);
    expect(await service.calculateBoost('u1', 's1')).toBe(11);
  });

  it('returns 0 with no events', async () => {
    prisma.scholarshipEvent.findMany.mockResolvedValue([]);
    expect(await service.calculateBoost('u1', 's1')).toBe(0);
  });
});
