import {
  IngestionJobStatus,
  IngestionSourceType,
  ScholarshipSource,
} from '@scholarpath/database';
import { IngestionService, IngestionSyncService } from './ingestion.service';
import { PrismaService } from '../prisma/prisma.module';
import { IngestionFetchService } from './ingestion-fetch.service';
import { MatchingService } from '../matching/matching.service';
import { StudentService } from '../student/student.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let prisma: {
    ingestionJob: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
    scholarship: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let fetchService: { fetchItems: jest.Mock };
  let syncService: { onExternalDataSynced: jest.Mock };

  beforeEach(() => {
    prisma = {
      ingestionJob: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      scholarship: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    fetchService = { fetchItems: jest.fn() };
    syncService = { onExternalDataSynced: jest.fn() };

    service = new IngestionService(
      prisma as unknown as PrismaService,
      fetchService as unknown as IngestionFetchService,
      syncService as unknown as IngestionSyncService,
    );
  });

  it('imports valid items with IMPORTED source and job audit', async () => {
    prisma.ingestionJob.create.mockResolvedValue({ id: 'job1' });
    prisma.ingestionJob.update.mockResolvedValue({});
    prisma.scholarship.findMany.mockResolvedValue([]);
    prisma.scholarship.create.mockResolvedValue({ id: 's1' });

    const result = await service.importScholarships({
      items: [
        {
          title: 'מלגת ייבוא',
          description: 'תיאור מפורט של המלגה לבדיקה',
        },
      ],
    });

    expect(result.jobId).toBe('job1');
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(prisma.scholarship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: ScholarshipSource.IMPORTED }),
      }),
    );
    expect(syncService.onExternalDataSynced).toHaveBeenCalledWith('job1');
  });

  it('updates existing IMPORTED row when sourceUrl matches', async () => {
    prisma.ingestionJob.create.mockResolvedValue({ id: 'job2' });
    prisma.ingestionJob.update.mockResolvedValue({});
    prisma.scholarship.findMany.mockResolvedValue([
      {
        id: 'existing',
        source: ScholarshipSource.IMPORTED,
        sourceUrl: 'https://example.org/scholarships/external-a',
      },
    ]);
    prisma.scholarship.update.mockResolvedValue({ id: 'existing' });

    const result = await service.importScholarships({
      items: [
        {
          title: 'מלגה מעודכנת',
          description: 'תיאור מפורט של המלגה לבדיקה',
          sourceUrl: 'https://example.org/scholarships/external-a/',
        },
      ],
    });

    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
    expect(prisma.scholarship.update).toHaveBeenCalled();
    expect(prisma.scholarship.create).not.toHaveBeenCalled();
  });

  it('creates new IMPORTED row when only SEED matches sourceUrl', async () => {
    prisma.ingestionJob.create.mockResolvedValue({ id: 'job3' });
    prisma.ingestionJob.update.mockResolvedValue({});
    prisma.scholarship.findMany.mockResolvedValue([]);
    prisma.scholarship.create.mockResolvedValue({ id: 'new1' });

    const result = await service.importScholarships({
      items: [
        {
          title: 'מלגה חדשה',
          description: 'תיאור מפורט של המלגה לבדיקה',
          sourceUrl: 'https://example.org/seed-only',
        },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);
    expect(prisma.scholarship.create).toHaveBeenCalled();
  });

  it('skips invalid items and continues batch', async () => {
    prisma.ingestionJob.create.mockResolvedValue({ id: 'job4' });
    prisma.ingestionJob.update.mockResolvedValue({});
    prisma.scholarship.findMany.mockResolvedValue([]);
    prisma.scholarship.create.mockResolvedValue({ id: 's1' });

    const result = await service.importScholarships({
      items: [
        { title: 'ab', description: 'too short title' },
        {
          title: 'מלגה תקינה',
          description: 'תיאור מפורט של המלגה לבדיקה',
        },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].index).toBe(0);
  });

  it('lists jobs with pagination', async () => {
    prisma.ingestionJob.findMany.mockResolvedValue([
      {
        id: 'j1',
        sourceType: IngestionSourceType.IMPORT,
        sourceRef: 'bulk-import',
        status: IngestionJobStatus.SUCCESS,
        imported: 1,
        updated: 0,
        skipped: 0,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);
    prisma.ingestionJob.count.mockResolvedValue(1);

    const result = await service.listJobs({ limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});

describe('IngestionSyncService', () => {
  it('refreshes recommendations for complete-profile students', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            profile: { fieldOfStudy: 'CS', year: 2, gpa: 90 },
          },
          {
            id: 'u2',
            profile: { fieldOfStudy: null, year: null, gpa: null },
          },
        ]),
      },
    };
    const matchingService = {
      refreshRecommendations: jest.fn().mockResolvedValue({ items: [] }),
    };
    const studentService = {
      isProfileComplete: jest.fn((p: { fieldOfStudy: string | null }) =>
        Boolean(p.fieldOfStudy),
      ),
    };

    const sync = new IngestionSyncService(
      prisma as unknown as PrismaService,
      matchingService as unknown as MatchingService,
      studentService as unknown as StudentService,
    );

    await sync['runSync']('job-sync-1');

    expect(matchingService.refreshRecommendations).toHaveBeenCalledTimes(1);
    expect(matchingService.refreshRecommendations).toHaveBeenCalledWith('u1');
  });
});
