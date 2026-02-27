import { TMDBMovieDto } from './tmdb-movies-response.dto';
import { TmdbTvShowResponseDto } from './tmdb-tv-show-response.dto';

export interface TmdbFindResponseDto {
  movie_results: TMDBMovieDto[];
  tv_results: TmdbTvShowResponseDto[];
}
