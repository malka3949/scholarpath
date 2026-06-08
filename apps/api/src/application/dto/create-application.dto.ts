import { IsString } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  scholarshipId!: string;
}
