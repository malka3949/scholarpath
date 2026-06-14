import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { StudentModule } from '../student/student.module';
import { IngestionAdminController } from './ingestion-admin.controller';
import { IngestionAllowlistService } from './ingestion-allowlist.service';
import { IngestionFetchService } from './ingestion-fetch.service';
import { IngestionSyncScheduler } from './ingestion-sync.scheduler';
import { IngestionService, IngestionSyncService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';

@Module({
  imports: [MatchingModule, StudentModule],
  controllers: [IngestionController, IngestionAdminController],
  providers: [
    IngestionService,
    IngestionSyncService,
    IngestionAllowlistService,
    IngestionFetchService,
    IngestionSyncScheduler,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
