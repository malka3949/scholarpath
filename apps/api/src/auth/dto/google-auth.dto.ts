import { IsEmail, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  googleId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
