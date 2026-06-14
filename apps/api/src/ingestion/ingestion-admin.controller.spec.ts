import { HttpException, NotFoundException } from '@nestjs/common';
import { IngestionJobStatus, IngestionSourceType } from '@scholarpath/database';
import { IngestionAdminController } from './ingestion-admin.controller';
import { IngestionService } from './ingestion.service';

describe('IngestionAdminController', () => {
  let controller: IngestionAdminController;
  let service: {
    listJobs: jest.Mock;
    getJob: jest.Mock;
    fetchFromSource: jest.Mock;
  };

  beforeEach(() => {
    service = {
      listJobs: jest.fn(),
      getJob: jest.fn(),
      fetchFromSource: jest.fn(),
    };
    controller = new IngestionAdminController(
      service as unknown as IngestionService,
    );
  });

  it('lists jobs with pagination params', async () => {
    service.listJobs.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const result = await controller.listJobs({ limit: 10, offset: 5 });

    expect(service.listJobs).toHaveBeenCalledWith({
      status: undefined,
      limit: 10,
      offset: 5,
    });
    expect(result.total).toBe(0);
  });

  it('returns job detail', async () => {
    service.getJob.mockResolvedValue({
      id: 'j1',
      sourceType: IngestionSourceType.FETCH,
      sourceRef: 'local-fixture',
      status: IngestionJobStatus.SUCCESS,
      imported: 2,
      updated: 0,
      skipped: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const job = await controller.getJob('j1');
    expect(job.id).toBe('j1');
  });

  it('throws 404 when job not found', async () => {
    service.getJob.mockResolvedValue(null);
    await expect(controller.getJob('missing')).rejects.toThrow(NotFoundException);
  });

  it('fetch returns ingestion result', async () => {
    service.fetchFromSource.mockResolvedValue({
      jobId: 'j2',
      imported: 2,
      updated: 0,
      skipped: 0,
    });

    const result = await controller.fetch(
      { user: { sub: 'admin-test-user-1' } },
      { sourceKey: 'local-fixture' },
    );

    expect(result.jobId).toBe('j2');
    expect(service.fetchFromSource).toHaveBeenCalledWith('local-fixture');
  });

  it('rate limits fetch within 60s for same admin', async () => {
    service.fetchFromSource.mockResolvedValue({
      jobId: 'j3',
      imported: 1,
      updated: 0,
      skipped: 0,
    });

    const req = { user: { sub: 'admin-rate-limit-user' } };
    await controller.fetch(req, { sourceKey: 'local-fixture' });

    await expect(
      controller.fetch(req, { sourceKey: 'local-fixture' }),
    ).rejects.toThrow(HttpException);
  });
});
