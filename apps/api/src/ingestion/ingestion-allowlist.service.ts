import { BadRequestException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IngestionAllowlistService {
  private readonly logger = new Logger(IngestionAllowlistService.name);
  private readonly allowlist: Record<string, string>;

  constructor() {
    this.allowlist = this.parseAllowlist(process.env.INGESTION_ALLOWLIST);
  }

  private parseAllowlist(raw: string | undefined): Record<string, string> {
    if (!raw?.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.logger.warn('INGESTION_ALLOWLIST is not a JSON object — using empty allowlist');
        return {};
      }
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.trim()) {
          result[key] = value.trim();
        }
      }
      return result;
    } catch {
      this.logger.warn('Failed to parse INGESTION_ALLOWLIST — using empty allowlist');
      return {};
    }
  }

  listKeys(): string[] {
    return Object.keys(this.allowlist);
  }

  getUrl(sourceKey: string): string {
    const url = this.allowlist[sourceKey];
    if (!url) {
      throw new BadRequestException(`מקור לא מוכר: ${sourceKey}`);
    }
    return url;
  }
}
