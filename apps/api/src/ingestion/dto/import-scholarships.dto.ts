import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { ImportScholarshipItemDto } from './import-scholarship-item.dto';

export class ImportScholarshipsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportScholarshipItemDto)
  items!: ImportScholarshipItemDto[];
}
