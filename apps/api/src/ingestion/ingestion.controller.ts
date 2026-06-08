import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { ImportScholarshipsDto } from './dto/import-scholarships.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/scholarships')
@UseGuards(JwtAuthGuard, AdminGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('import')
  import(@Body() dto: ImportScholarshipsDto) {
    return this.ingestionService.importScholarships(dto);
  }
}
