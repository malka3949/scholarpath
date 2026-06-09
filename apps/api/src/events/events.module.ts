import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { ScholarshipEventsController } from './scholarship-events.controller';
import { ActionModule } from '../action/action.module';

@Module({
  imports: [ActionModule],
  controllers: [ScholarshipEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
