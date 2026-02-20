import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  Max,
} from 'class-validator';
import { MAX_LIMIT } from 'src/const/max-limit';
import { PersonRole } from 'src/entities';

export class GetPersonStatsQuery {
  @IsNotEmpty()
  @IsEnum(PersonRole)
  role: PersonRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(MAX_LIMIT)
  limit?: number = 10;
}
