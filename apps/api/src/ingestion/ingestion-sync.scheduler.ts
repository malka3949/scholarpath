import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IngestionAllowlistService } from './ingestion-allowlist.service';
import { IngestionService } from './ingestion.service';

@Injectable()
export class IngestionSyncScheduler {
  private readonly logger = new Logger(IngestionSyncScheduler.name);

  constructor(
    private readonly allowlist: IngestionAllowlistService,
    private readonly ingestionService: IngestionService,
  ) {}

  // Valid fallback required — invalid cron (e.g. Feb 31) crashes Nest bootstrap.
  @Cron(process.env.CRON_INGESTION_SYNC || CronExpression.EVERY_YEAR)
  async handleScheduledSync() {
    const cron = process.env.CRON_INGESTION_SYNC?.trim();
    if (!cron) {
      return;
    }

    const keys = this.allowlist.listKeys();
    if (keys.length === 0) {
      this.logger.log('Scheduled ingestion sync: no allowlist keys configured');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const key of keys) {
      try {
        await this.ingestionService.fetchFromSource(key);
        success++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `Scheduled ingestion sync failed for key ${key}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `Scheduled ingestion sync: ${success} succeeded, ${failed} failed (${keys.length} keys)`,
    );
  }
}
