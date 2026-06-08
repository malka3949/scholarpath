import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'תגובה לא יכולה להיות ריקה' })
  @MaxLength(1500, { message: 'תגובה עד 1500 תווים' })
  body!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
