import { IsEmail, IsNotEmpty, IsString, IsDate, IsUUID } from 'class-validator';

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
}
