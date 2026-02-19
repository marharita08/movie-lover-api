import { MovieDetailsResponseDto } from './movie-details-response.dto';
import { TvShowDetailsResponseDto } from './tv-show-details-response.dto';

export interface FindResponseDto {
  movieResults: MovieDetailsResponseDto[];
  tvResults: TvShowDetailsResponseDto[];
  personResults: any[];
  tvEpisodeResults: any[];
  tvSeasonResults: any[];
}
