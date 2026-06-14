import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IngestionJobStatus } from '@scholarpath/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FetchIngestionDto } from './dto/fetch-ingestion.dto';
import { ListIngestionJobsDto } from './dto/list-ingestion-jobs.dto';
import { IngestionService } from './ingestion.service';

const FETCH_COOLDOWN_MS = 60_000;
const fetchTimestamps = new Map<string, number>();

@Controller('admin/ingestion')
@UseGuards(JwtAuthGuard, AdminGuard)
export class IngestionAdminController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get('jobs')
  listJobs(@Query() query: ListIngestionJobsDto) {
    return this.ingestionService.listJobs({
      status: query.status,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.ingestionService.getJob(id);
    if (!job) {
      throw new NotFoundException('job לא נמצא');
    }
    return job;
  }

  @Post('fetch')
  async fetch(
    @Req() req: { user: { sub: string } },
    @Body() dto: FetchIngestionDto,
  ) {
    const userId = req.user.sub;
    const now = Date.now();
    const last = fetchTimestamps.get(userId) ?? 0;
    if (now - last < FETCH_COOLDOWN_MS) {
      throw new HttpException(
        'ניתן למשוך ממקור חיצוני פעם בדקה',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    fetchTimestamps.set(userId, now);

    return this.ingestionService.fetchFromSource(dto.sourceKey);
  }
}
