import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

import { Language } from 'src/entities';

export class UserDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsDate()
  @IsNotEmpty()
  lastLoginAt: Date;

  @IsDate()
  @IsNotEmpty()
  lastActiveAt: Date;

  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;

  @IsEnum(Language)
  @IsNotEmpty()
  language: Language;
}
