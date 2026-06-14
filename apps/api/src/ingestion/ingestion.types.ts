export type IngestionResult = {
  jobId: string;
  imported: number;
  updated: number;
  skipped: number;
  errors?: { index: number; message: string }[];
};

export type IngestionJobSummary = {
  id: string;
  sourceType: string;
  sourceRef: string;
  status: string;
  imported: number;
  updated: number;
  skipped: number;
  startedAt: Date;
  completedAt: Date | null;
  errorLog?: unknown;
};

export type IngestionJobListResponse = {
  items: IngestionJobSummary[];
  total: number;
  limit: number;
  offset: number;
};

export function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const scheme = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : '';
    let pathname = parsed.pathname.replace(/\/+$/, '') || '';
    return `${scheme}//${host}${port}${pathname}${parsed.search}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}
