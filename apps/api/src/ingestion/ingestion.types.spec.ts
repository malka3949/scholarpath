import { normalizeSourceUrl } from './ingestion.types';

describe('normalizeSourceUrl', () => {
  it('lowercases scheme and host and strips trailing slash', () => {
    expect(
      normalizeSourceUrl('HTTPS://Example.org/scholarships/external-a/'),
    ).toBe('https://example.org/scholarships/external-a');
  });

  it('preserves query string', () => {
    expect(normalizeSourceUrl('https://Example.org/path?x=1')).toBe(
      'https://example.org/path?x=1',
    );
  });
});
