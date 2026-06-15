import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import { Language } from 'src/entities';

export class TvShowSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
