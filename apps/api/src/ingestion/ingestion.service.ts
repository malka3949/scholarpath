import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IngestionJobStatus,
  IngestionSourceType,
  Role,
  ScholarshipSource,
} from '@scholarpath/database';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.module';
import { StudentService } from '../student/student.service';
import { MatchingService } from '../matching/matching.service';
import { ImportScholarshipItemDto } from './dto/import-scholarship-item.dto';
import { ImportScholarshipsDto } from './dto/import-scholarships.dto';
import { IngestionFetchService } from './ingestion-fetch.service';
import {
  IngestionJobListResponse,
  IngestionJobSummary,
  IngestionResult,
  normalizeSourceUrl,
} from './ingestion.types';

@Injectable()
export class IngestionSyncService {
  private readonly logger = new Logger(IngestionSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
    private readonly studentService: StudentService,
  ) {}

  onExternalDataSynced(jobId: string): void {
    void this.runSync(jobId);
  }

  private async runSync(jobId: string): Promise<void> {
    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT },
      include: { profile: true },
    });

    const complete = students.filter(
      (s) => s.profile && this.studentService.isProfileComplete(s.profile),
    );

    let refreshed = 0;
    let failures = 0;

    for (const student of complete) {
      try {
        await this.matchingService.refreshRecommendations(student.id);
        refreshed++;
      } catch (err) {
        failures++;
        this.logger.warn(
          `Ingestion sync job ${jobId}: failed refresh for user ${student.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `Ingestion sync job ${jobId}: refreshed ${refreshed} students, ${failures} failures`,
    );
  }
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fetchService: IngestionFetchService,
    private readonly syncService: IngestionSyncService,
  ) {}

  async importScholarships(dto: ImportScholarshipsDto): Promise<IngestionResult> {
    return this.processItems(dto.items, {
      sourceType: IngestionSourceType.IMPORT,
      sourceRef: 'bulk-import',
    });
  }

  async fetchFromSource(sourceKey: string): Promise<IngestionResult> {
    const job = await this.prisma.ingestionJob.create({
      data: {
        sourceType: IngestionSourceType.FETCH,
        sourceRef: sourceKey,
        status: IngestionJobStatus.RUNNING,
      },
    });

    try {
      const items = await this.fetchService.fetchItems(sourceKey);
      return this.processItems(items, {
        sourceType: IngestionSourceType.FETCH,
        sourceRef: sourceKey,
        existingJobId: job.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה במשיכה';
      await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionJobStatus.FAILED,
          completedAt: new Date(),
          errorLog: { message } as Prisma.InputJsonValue,
        },
      });
      throw new BadRequestException(message);
    }
  }

  async listJobs(params: {
    status?: IngestionJobStatus;
    limit: number;
    offset: number;
  }): Promise<IngestionJobListResponse> {
    const where = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.ingestionJob.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.ingestionJob.count({ where }),
    ]);

    return {
      items: items.map((j) => this.toJobSummary(j)),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async getJob(id: string): Promise<IngestionJobSummary | null> {
    const job = await this.prisma.ingestionJob.findUnique({ where: { id } });
    if (!job) return null;
    return this.toJobSummary(job);
  }

  private toJobSummary(job: {
    id: string;
    sourceType: IngestionSourceType;
    sourceRef: string;
    status: IngestionJobStatus;
    imported: number;
    updated: number;
    skipped: number;
    startedAt: Date;
    completedAt: Date | null;
    errorLog?: unknown;
  }): IngestionJobSummary {
    return {
      id: job.id,
      sourceType: job.sourceType,
      sourceRef: job.sourceRef,
      status: job.status,
      imported: job.imported,
      updated: job.updated,
      skipped: job.skipped,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      ...(job.errorLog !== undefined && job.errorLog !== null
        ? { errorLog: job.errorLog }
        : {}),
    };
  }

  private async processItems(
    rawItems: ImportScholarshipItemDto[] | ImportScholarshipsDto['items'],
    meta: {
      sourceType: IngestionSourceType;
      sourceRef: string;
      existingJobId?: string;
    },
  ): Promise<IngestionResult> {
    const job = meta.existingJobId
      ? await this.prisma.ingestionJob.update({
          where: { id: meta.existingJobId },
          data: { status: IngestionJobStatus.RUNNING },
        })
      : await this.prisma.ingestionJob.create({
          data: {
            sourceType: meta.sourceType,
            sourceRef: meta.sourceRef,
            status: IngestionJobStatus.RUNNING,
          },
        });

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = plainToInstance(ImportScholarshipItemDto, rawItems[i]);
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
        const outcome = await this.upsertItem(item);
        if (outcome === 'updated') {
          updated++;
        } else {
          imported++;
        }
      } catch (err) {
        skipped++;
        errors.push({
          index: i,
          message: err instanceof Error ? err.message : 'שגיאה ביצירה',
        });
      }
    }

    await this.prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCESS,
        imported,
        updated,
        skipped,
        completedAt: new Date(),
        ...(errors.length > 0
          ? { errorLog: errors as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });

    if (imported + updated > 0) {
      this.syncService.onExternalDataSynced(job.id);
    }

    return {
      jobId: job.id,
      imported,
      updated,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  private async upsertItem(
    item: ImportScholarshipItemDto,
  ): Promise<'created' | 'updated'> {
    const data = {
      title: item.title,
      description: item.description,
      deadline: item.deadline ? new Date(item.deadline) : null,
      sourceUrl: item.sourceUrl ?? null,
      tags: item.tags ?? [],
      eligibilityRules: item.eligibilityRules as Prisma.InputJsonValue | undefined,
      source: ScholarshipSource.IMPORTED,
    };

    if (!item.sourceUrl) {
      await this.prisma.scholarship.create({ data });
      return 'created';
    }

    const normalized = normalizeSourceUrl(item.sourceUrl);
    const importedRows = await this.prisma.scholarship.findMany({
      where: { source: ScholarshipSource.IMPORTED, sourceUrl: { not: null } },
    });

    const existing = importedRows.find(
      (row) => row.sourceUrl && normalizeSourceUrl(row.sourceUrl) === normalized,
    );

    if (existing) {
      await this.prisma.scholarship.update({
        where: { id: existing.id },
        data,
      });
      return 'updated';
    }

    await this.prisma.scholarship.create({ data });
    return 'created';
  }
}
