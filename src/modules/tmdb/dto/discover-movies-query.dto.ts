import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import { Language } from 'src/entities';

export class DiscoverMoviesQueryDto {
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @IsInt()
  page: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  primaryReleaseYear: number;

  @IsOptional()
  @IsString()
  sortBy: string;

  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
