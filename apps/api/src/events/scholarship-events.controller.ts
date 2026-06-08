import { Controller, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { RecordEventDto } from './dto/record-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scholarships')
export class ScholarshipEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post(':id/events')
  @UseGuards(JwtAuthGuard)
  record(
    @Req() req: { user: { sub: string } },
    @Param('id') scholarshipId: string,
    @Body() dto: RecordEventDto,
  ) {
    return this.eventsService.recordEvent(
      req.user.sub,
      scholarshipId,
      dto.eventType,
    );
  }
}
