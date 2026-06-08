import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
