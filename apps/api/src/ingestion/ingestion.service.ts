import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ScholarshipSource } from '@scholarpath/database';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.module';
import { ImportScholarshipItemDto } from './dto/import-scholarship-item.dto';
import { ImportScholarshipsDto } from './dto/import-scholarships.dto';

@Injectable()
export class IngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async importScholarships(dto: ImportScholarshipsDto) {
    let imported = 0;
    let skipped = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = plainToInstance(ImportScholarshipItemDto, dto.items[i]);
      const validationErrors = await validate(item);
      if (validationErrors.length > 0) {
        skipped++;
        errors.push({
          index: i,
          message: validationErrors
            .map((e) => Object.values(e.constraints ?? {}).join(', '))
            .join('; '),
        });
        continue;
      }

      try {
        await this.prisma.scholarship.create({
          data: {
            title: item.title,
            description: item.description,
            deadline: item.deadline ? new Date(item.deadline) : null,
            sourceUrl: item.sourceUrl ?? null,
            tags: item.tags ?? [],
            eligibilityRules: item.eligibilityRules as
              | Prisma.InputJsonValue
              | undefined,
            source: ScholarshipSource.IMPORTED,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
        errors.push({
          index: i,
          message: err instanceof Error ? err.message : 'שגיאה ביצירה',
        });
      }
    }

    return {
      imported,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }
}
