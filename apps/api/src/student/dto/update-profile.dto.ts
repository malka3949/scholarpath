import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gpa?: number;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;
}
