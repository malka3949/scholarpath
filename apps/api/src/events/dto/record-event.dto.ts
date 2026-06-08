import { IsEnum } from 'class-validator';
import { ScholarshipEventType } from '@scholarpath/database';

export class RecordEventDto {
  @IsEnum(ScholarshipEventType)
  eventType!: ScholarshipEventType;
}
