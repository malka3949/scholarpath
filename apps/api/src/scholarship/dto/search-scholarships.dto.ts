import { IsOptional, IsString } from 'class-validator';

export class SearchScholarshipsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
