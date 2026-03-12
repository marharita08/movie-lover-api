import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  googleId?: string;

  @IsString()
  @IsOptional()
  passwordHash?: string;

  @IsDate()
  @IsOptional()
  lastLoginAt?: Date;

  @IsDate()
  @IsOptional()
  lastActiveAt?: Date;

  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;
}
