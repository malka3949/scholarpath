import * as fs from 'fs/promises';
import { IngestionFetchService } from './ingestion-fetch.service';
import { IngestionAllowlistService } from './ingestion-allowlist.service';

jest.mock('fs/promises');

describe('IngestionFetchService', () => {
  const allowlist = {
    getUrl: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses array JSON from file URL', async () => {
    allowlist.getUrl.mockReturnValue('file://./fixtures/scholarships-external.json');
    (fs.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify([
        {
          title: 'מלגה חיצונית',
          description: 'תיאור מפורט של מלגה חיצונית לבדיקה',
          sourceUrl: 'https://example.org/a',
        },
      ]),
    );

    const service = new IngestionFetchService(
      allowlist as unknown as IngestionAllowlistService,
    );
    const items = await service.fetchItems('local-fixture');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('מלגה חיצונית');
  });

  it('parses { items: [...] } wrapper from file URL', async () => {
    allowlist.getUrl.mockReturnValue('file://./fixtures/wrapped.json');
    (fs.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        items: [
          {
            title: 'מלגה עטופה',
            description: 'תיאור מפורט של מלגה עטופה לבדיקה',
          },
        ],
      }),
    );

    const service = new IngestionFetchService(
      allowlist as unknown as IngestionAllowlistService,
    );
    const items = await service.fetchItems('wrapped');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('מלגה עטופה');
  });
});
