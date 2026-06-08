import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateMotivationLetterDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
