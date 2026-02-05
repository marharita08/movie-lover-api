import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&()[\]{}#^+=_-]).{8,}$/;

export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password: string;
}
