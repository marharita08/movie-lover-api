import { TmdbPaginatedResponseDto } from './tmdb-paginated-response.dto';

export interface TMDBMovieDto {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string | null;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export type TMDBMoviesResponseDto = TmdbPaginatedResponseDto<TMDBMovieDto>;
