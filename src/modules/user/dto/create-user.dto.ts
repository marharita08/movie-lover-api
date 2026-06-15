import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { Language } from 'src/entities';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  passwordHash?: string;

  @IsDate()
  @IsNotEmpty()
  lastLoginAt: Date;

  @IsDate()
  @IsNotEmpty()
  lastActiveAt: Date;

  @IsString()
  @IsOptional()
  googleId?: string;

  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;

  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
