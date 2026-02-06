import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { OtpPurpose } from 'src/entities';

export class SendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OtpPurpose)
  @IsNotEmpty()
  purpose: OtpPurpose;
}
