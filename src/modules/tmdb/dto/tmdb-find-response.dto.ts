import { TmdbMovieDetailsResponseDto } from './tmdb-movie-details-response.dto';
import { TmdbTvShowDetailsResponseDto } from './tmdb-tv-show-details-response.dto';

export interface TmdbFindResponseDto {
  movie_results: TmdbMovieDetailsResponseDto[];
  tv_results: TmdbTvShowDetailsResponseDto[];
}
