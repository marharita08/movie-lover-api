import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

import { PASSWORD_REGEX } from '../const';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password: string;
}
