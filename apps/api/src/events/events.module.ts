import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { ScholarshipEventsController } from './scholarship-events.controller';

@Module({
  controllers: [ScholarshipEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
