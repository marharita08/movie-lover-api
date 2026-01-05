import { IsDate, IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  passwordHash: string;

  @IsDate()
  @IsNotEmpty()
  lastLoginAt: Date;

  @IsDate()
  @IsNotEmpty()
  lastActiveAt: Date;
}
