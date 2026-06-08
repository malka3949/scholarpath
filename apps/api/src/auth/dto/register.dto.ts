import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'סיסמה חייבת להכיל לפחות 6 תווים' })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'שם חייב להכיל לפחות 2 תווים' })
  name!: string;
}
