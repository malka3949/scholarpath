import { IngestionSyncScheduler } from './ingestion-sync.scheduler';
import { IngestionAllowlistService } from './ingestion-allowlist.service';
import { IngestionService } from './ingestion.service';

describe('IngestionSyncScheduler', () => {
  const originalCron = process.env.CRON_INGESTION_SYNC;

  afterEach(() => {
    process.env.CRON_INGESTION_SYNC = originalCron;
  });

  it('no-ops when CRON_INGESTION_SYNC is empty', async () => {
    process.env.CRON_INGESTION_SYNC = '';
    const allowlist = { listKeys: jest.fn() };
    const ingestionService = { fetchFromSource: jest.fn() };
    const scheduler = new IngestionSyncScheduler(
      allowlist as unknown as IngestionAllowlistService,
      ingestionService as unknown as IngestionService,
    );

    await scheduler.handleScheduledSync();

    expect(allowlist.listKeys).not.toHaveBeenCalled();
  });

  it('fetches all allowlist keys when cron env is set', async () => {
    process.env.CRON_INGESTION_SYNC = '0 8 * * *';
    const allowlist = {
      listKeys: jest.fn().mockReturnValue(['key-a', 'key-b']),
    };
    const ingestionService = {
      fetchFromSource: jest.fn().mockResolvedValue({ jobId: 'j1' }),
    };
    const scheduler = new IngestionSyncScheduler(
      allowlist as unknown as IngestionAllowlistService,
      ingestionService as unknown as IngestionService,
    );

    await scheduler.handleScheduledSync();

    expect(ingestionService.fetchFromSource).toHaveBeenCalledTimes(2);
    expect(ingestionService.fetchFromSource).toHaveBeenCalledWith('key-a');
    expect(ingestionService.fetchFromSource).toHaveBeenCalledWith('key-b');
  });
});
