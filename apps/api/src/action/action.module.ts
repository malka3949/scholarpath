import { Module } from '@nestjs/common';
import { ActionService } from './action.service';
import { ActionScoringService } from './action-scoring.service';
import { ActionExpirationService } from './action-expiration.service';
import { ActionController } from './action.controller';
import { ActionAdminController } from './action-admin.controller';
import { ActionReconciliationScheduler } from './action-reconciliation.scheduler';

@Module({
  controllers: [ActionController, ActionAdminController],
  providers: [
    ActionService,
    ActionScoringService,
    ActionExpirationService,
    ActionReconciliationScheduler,
  ],
  exports: [ActionService],
})
export class ActionModule {}
