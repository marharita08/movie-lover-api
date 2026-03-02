import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class MultiSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @IsInt()
  page?: number;
}
