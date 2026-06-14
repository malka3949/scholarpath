import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IngestionJobStatus } from '@scholarpath/database';

const VALID_STATUSES = Object.values(IngestionJobStatus);

export class ListIngestionJobsDto {
  @IsOptional()
  @IsIn(VALID_STATUSES)
  status?: IngestionJobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
