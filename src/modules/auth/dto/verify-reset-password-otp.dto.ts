import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class VerifyResetPasswordOtpDto {
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumber()
  @IsNotEmpty()
  code: number;
}
