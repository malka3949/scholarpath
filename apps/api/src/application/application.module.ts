import { Module } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationController } from './application.controller';
import { AiModule } from '../ai/ai.module';
import { StudentModule } from '../student/student.module';
import { NotificationModule } from '../notification/notification.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [AiModule, StudentModule, NotificationModule, EventsModule],
  controllers: [ApplicationController],
  providers: [ApplicationService],
})
export class ApplicationModule {}
