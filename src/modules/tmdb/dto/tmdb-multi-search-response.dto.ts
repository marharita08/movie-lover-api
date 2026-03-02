import { TMDBMovieDto } from './tmdb-movies-response.dto';
import { TmdbPersonResponseDto } from './tmdb-person-response.dto';
import { TmdbTvShowResponseDto } from './tmdb-tv-show-response.dto';

export enum MultiSearchMediaType {
  MOVIE = 'movie',
  TV = 'tv',
  PERSON = 'person',
}

export type TmdbMultiSearchItem = (
  | TMDBMovieDto
  | TmdbTvShowResponseDto
  | TmdbPersonResponseDto
) & {
  media_type: MultiSearchMediaType;
};

export interface TmdbMultiSearchResponseDto {
  page: number;
  results: TmdbMultiSearchItem[];
  total_pages: number;
  total_results: number;
}
