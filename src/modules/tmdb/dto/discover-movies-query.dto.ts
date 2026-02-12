import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class DiscoverMoviesQueryDto {
  @IsNumber()
  @IsOptional()
  @IsPositive()
  year: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  page: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  primaryReleaseYear: number;

  @IsString()
  @IsOptional()
  sortBy: string;
}
