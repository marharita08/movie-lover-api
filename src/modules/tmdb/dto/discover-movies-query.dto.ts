import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class DiscoverMoviesQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  year: number;

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
}
