import { IsEnum, IsOptional, IsString } from 'class-validator';

import { Language } from 'src/entities';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
