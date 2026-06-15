import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import { Language } from 'src/entities';

export class MultiSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
