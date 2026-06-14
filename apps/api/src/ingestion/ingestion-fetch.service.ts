import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ImportScholarshipItemDto } from './dto/import-scholarship-item.dto';
import { IngestionAllowlistService } from './ingestion-allowlist.service';

@Injectable()
export class IngestionFetchService {
  private readonly timeoutMs: number;

  constructor(private readonly allowlist: IngestionAllowlistService) {
    this.timeoutMs = parseInt(process.env.INGESTION_FETCH_TIMEOUT_MS ?? '30000', 10);
  }

  async fetchItems(sourceKey: string): Promise<ImportScholarshipItemDto[]> {
    const url = this.allowlist.getUrl(sourceKey);
    const raw = await this.fetchRaw(url);
    const parsed = this.parsePayload(raw);
    return this.validateItems(parsed);
  }

  private async fetchRaw(url: string): Promise<unknown> {
    if (url.startsWith('file://')) {
      const filePath = this.resolveFilePath(url);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as unknown;
    }

    if (!url.startsWith('https://')) {
      throw new Error('רק כתובות https:// מותרות בסביבת production');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'ScholarPath-Ingestion/1.0' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as unknown;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`תם הזמן (${this.timeoutMs}ms) בזמן משיכה מ-${url}`);
      }
      const detail =
        err instanceof Error && err.cause instanceof Error
          ? err.cause.message
          : err instanceof Error
            ? err.message
            : String(err);
      throw new Error(`לא ניתן למשוך מ-${url}: ${detail}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveFilePath(url: string): string {
    const relative = url.replace(/^file:\/\//, '').replace(/^\.\//, '');
    // Monorepo root (not process.cwd(), which is apps/api under turbo/npm).
    const repoRoot = path.resolve(__dirname, '../../../../');
    return path.resolve(repoRoot, relative);
  }

  private parsePayload(raw: unknown): unknown[] {
    if (Array.isArray(raw)) {
      return raw;
    }
    if (
      typeof raw === 'object' &&
      raw !== null &&
      Array.isArray((raw as { items?: unknown[] }).items)
    ) {
      return (raw as { items: unknown[] }).items;
    }
    throw new Error('תגובה חיצונית חייבת להיות מערך או { "items": [...] }');
  }

  private async validateItems(items: unknown[]): Promise<ImportScholarshipItemDto[]> {
    const result: ImportScholarshipItemDto[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = plainToInstance(ImportScholarshipItemDto, items[i]);
      const errors = await validate(item);
      if (errors.length > 0) {
        const message = errors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .join('; ');
        throw new Error(`פריט ${i}: ${message}`);
      }
      result.push(item);
    }
    return result;
  }
}
