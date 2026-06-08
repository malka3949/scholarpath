import { DeadlineSyncScheduler } from './deadline-sync.scheduler';
import { NotificationService } from './notification.service';

describe('DeadlineSyncScheduler', () => {
  it('handleDeadlineSync calls syncDeadlineNotificationsForAllStudents', async () => {
    const notificationService = {
      syncDeadlineNotificationsForAllStudents: jest
        .fn()
        .mockResolvedValue(3),
    };
    const scheduler = new DeadlineSyncScheduler(
      notificationService as unknown as NotificationService,
    );

    await scheduler.handleDeadlineSync();

    expect(
      notificationService.syncDeadlineNotificationsForAllStudents,
    ).toHaveBeenCalled();
  });
});
