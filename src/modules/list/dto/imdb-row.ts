import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IMDBRow {
  @IsNotEmpty()
  @IsString()
  Const: string;

  @IsOptional()
  @IsString()
  'Your Rating'?: string;

  @IsOptional()
  @IsString()
  'Date Rated'?: string;

  @IsNotEmpty()
  @IsString()
  Title: string;

  @IsOptional()
  @IsString()
  URL?: string;

  @IsOptional()
  @IsString()
  'Title Type'?: string;

  @IsOptional()
  @IsString()
  'IMDb Rating'?: string;

  @IsOptional()
  @IsString()
  'Runtime (mins)'?: string;

  @IsOptional()
  @IsString()
  Year?: string;

  @IsNotEmpty()
  @IsString()
  Genres: string;

  @IsOptional()
  @IsString()
  'Num Votes'?: string;

  @IsOptional()
  @IsString()
  'Release Date'?: string;

  @IsOptional()
  @IsString()
  Directors?: string;
}
