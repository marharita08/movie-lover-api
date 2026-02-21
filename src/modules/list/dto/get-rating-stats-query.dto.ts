import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import { MediaType } from 'src/entities';

export class GetRatingStatsQueryDto {
  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;
}
