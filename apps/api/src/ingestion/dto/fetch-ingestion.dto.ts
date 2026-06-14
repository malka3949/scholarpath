import { IsNotEmpty, IsString } from 'class-validator';

export class FetchIngestionDto {
  @IsString()
  @IsNotEmpty()
  sourceKey!: string;
}
