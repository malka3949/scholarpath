import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { RuleFilterService } from './rule-filter.service';
import { BehaviorBoostService } from './behavior-boost.service';
import { StudentModule } from '../student/student.module';
import { AiModule } from '../ai/ai.module';
import { ActionModule } from '../action/action.module';

@Module({
  imports: [StudentModule, AiModule, ActionModule],
  controllers: [MatchingController],
  providers: [MatchingService, RuleFilterService, BehaviorBoostService],
  exports: [MatchingService, RuleFilterService, BehaviorBoostService],
})
export class MatchingModule {}
