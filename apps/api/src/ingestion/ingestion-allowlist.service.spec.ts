import { BadRequestException } from '@nestjs/common';
import { IngestionAllowlistService } from './ingestion-allowlist.service';

describe('IngestionAllowlistService', () => {
  const originalEnv = process.env.INGESTION_ALLOWLIST;

  afterEach(() => {
    process.env.INGESTION_ALLOWLIST = originalEnv;
  });

  it('parses valid allowlist JSON', () => {
    process.env.INGESTION_ALLOWLIST = JSON.stringify({
      'local-fixture': 'file://./fixtures/scholarships-external.json',
      prod: 'https://example.org/data.json',
    });
    const service = new IngestionAllowlistService();

    expect(service.listKeys()).toEqual(['local-fixture', 'prod']);
    expect(service.getUrl('local-fixture')).toContain('file://');
  });

  it('throws BadRequestException for unknown key', () => {
    process.env.INGESTION_ALLOWLIST = '{}';
    const service = new IngestionAllowlistService();

    expect(() => service.getUrl('unknown')).toThrow(BadRequestException);
  });

  it('uses empty allowlist on invalid JSON', () => {
    process.env.INGESTION_ALLOWLIST = 'not-json';
    const service = new IngestionAllowlistService();

    expect(service.listKeys()).toEqual([]);
  });
});
