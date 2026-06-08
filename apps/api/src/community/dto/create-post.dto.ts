import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(5, { message: 'כותרת חייבת להכיל לפחות 5 תווים' })
  @MaxLength(120, { message: 'כותרת עד 120 תווים' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'תוכן חייב להכיל לפחות 10 תווים' })
  @MaxLength(3000, { message: 'תוכן עד 3000 תווים' })
  body!: string;
}
