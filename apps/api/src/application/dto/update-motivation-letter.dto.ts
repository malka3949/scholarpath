import { IsString, MinLength } from 'class-validator';

export class UpdateMotivationLetterDto {
  @IsString()
  @MinLength(1, { message: 'מכתב המוטיבציה לא יכול להיות ריק' })
  motivationLetter!: string;
}
