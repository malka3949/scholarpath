import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentModule } from './student/student.module';
import { ScholarshipModule } from './scholarship/scholarship.module';
import { ApplicationModule } from './application/application.module';
import { AdminModule } from './admin/admin.module';
import { MatchingModule } from './matching/matching.module';
import { NotificationModule } from './notification/notification.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { EventsModule } from './events/events.module';
import { CommunityModule } from './community/community.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    StudentModule,
    ScholarshipModule,
    ApplicationModule,
    AdminModule,
    MatchingModule,
    NotificationModule,
    IngestionModule,
    EventsModule,
    CommunityModule,
  ],
})
export class AppModule {}
