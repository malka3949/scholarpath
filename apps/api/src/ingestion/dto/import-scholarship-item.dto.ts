import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUrl,
  IsArray,
  IsObject,
  IsDateString,
  ArrayMaxSize,
} from 'class-validator';

export class ImportScholarshipItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  eligibilityRules?: Record<string, unknown>;
}
