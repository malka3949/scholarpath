import { ScholarshipSource } from '@scholarpath/database';
import { IngestionService } from './ingestion.service';
import { PrismaService } from '../prisma/prisma.module';

describe('IngestionService', () => {
  let service: IngestionService;
  let prisma: { scholarship: { create: jest.Mock } };

  beforeEach(() => {
    prisma = { scholarship: { create: jest.fn() } };
    service = new IngestionService(prisma as unknown as PrismaService);
  });

  it('imports valid items with IMPORTED source', async () => {
    prisma.scholarship.create.mockResolvedValue({ id: 's1' });

    const result = await service.importScholarships({
      items: [
        {
          title: 'מלגת ייבוא',
          description: 'תיאור מפורט של המלגה לבדיקה',
        },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(prisma.scholarship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: ScholarshipSource.IMPORTED }),
      }),
    );
  });

  it('skips invalid items and continues batch', async () => {
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

  it('rejects more than 50 items at validation layer', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      title: `מלגה מספר ${i} ארוכה`,
      description: 'תיאור מפורט של המלגה לבדיקת מגבלת כמות',
    }));

    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const { ImportScholarshipsDto } = await import('./dto/import-scholarships.dto');
    const dto = plainToInstance(ImportScholarshipsDto, { items });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
