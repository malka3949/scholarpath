import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '@scholarpath/database';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
