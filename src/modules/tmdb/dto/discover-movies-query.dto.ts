import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class DiscoverMoviesQueryDto {
  @IsNumber()
  @IsOptional()
  @IsPositive()
  year: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @IsInt()
  page: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  primaryReleaseYear: number;

  @IsString()
  @IsOptional()
  sortBy: string;
}
