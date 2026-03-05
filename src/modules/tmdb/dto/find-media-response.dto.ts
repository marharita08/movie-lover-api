import { MediaType } from 'src/entities';

import { MovieDto } from './movies-response.dto';
import { TvShowResponseDto } from './tv-show-response.dto';

export interface FindMediaResponseDto {
  type: MediaType;
  data: MovieDto | TvShowResponseDto;
}
