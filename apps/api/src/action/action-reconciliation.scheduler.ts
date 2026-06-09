import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActionService } from './action.service';

@Injectable()
export class ActionReconciliationScheduler {
  private readonly logger = new Logger(ActionReconciliationScheduler.name);

  constructor(private readonly actionService: ActionService) {}

  @Cron(process.env.CRON_ACTION_RECONCILE ?? CronExpression.EVERY_DAY_AT_7AM)
  async handleReconciliation() {
    const { users } = await this.actionService.reconcileAllStudents();
    this.logger.log(`Scheduled action reconciliation: ${users} student(s) processed`);
  }
}
