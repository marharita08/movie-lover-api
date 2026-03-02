import { MovieDto } from './movies-response.dto';
import { PersonResponseDto } from './person-response.dto';
import { MultiSearchMediaType } from './tmdb-multi-search-response.dto';
import { TvShowResponseDto } from './tv-show-response.dto';

export type MultiSearchResponseItem = (
  | MovieDto
  | TvShowResponseDto
  | PersonResponseDto
) & {
  mediaType: MultiSearchMediaType;
};

export interface MultiSearchResponseDto {
  page: number;
  results: MultiSearchResponseItem[];
  totalPages: number;
  totalResults: number;
}
