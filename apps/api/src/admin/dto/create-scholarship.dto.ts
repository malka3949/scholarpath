import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateScholarshipDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsObject()
  eligibilityRules?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsUrl({}, { message: 'כתובת URL לא תקינה' })
  sourceUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
