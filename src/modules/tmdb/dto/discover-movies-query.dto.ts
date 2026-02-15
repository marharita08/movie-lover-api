import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class DiscoverMoviesQueryDto {
  @IsInt()
  @IsOptional()
  @IsPositive()
  year: number;

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @IsInt()
  page: number;

  @IsInt()
  @IsOptional()
  @IsPositive()
  primaryReleaseYear: number;

  @IsString()
  @IsOptional()
  sortBy: string;
}
