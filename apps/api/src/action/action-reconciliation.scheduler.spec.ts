import { ActionReconciliationScheduler } from './action-reconciliation.scheduler';
import { ActionService } from './action.service';

describe('ActionReconciliationScheduler', () => {
  it('reconciles all students on cron', async () => {
    const actionService = {
      reconcileAllStudents: jest.fn().mockResolvedValue({ users: 2 }),
    };
    const scheduler = new ActionReconciliationScheduler(
      actionService as unknown as ActionService,
    );

    await scheduler.handleReconciliation();

    expect(actionService.reconcileAllStudents).toHaveBeenCalled();
  });
});
