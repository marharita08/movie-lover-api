import { Controller, Get, Param, Query } from '@nestjs/common';

import {
  DiscoverMoviesQueryDto,
  MovieDetailsResponseDto,
  MoviesResponseDto,
} from './dto';
import { TmdbService } from './tmdb.service';

@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdbService: TmdbService) {}

  @Get('discover/movie')
  async discoverMovies(
    @Query() query: DiscoverMoviesQueryDto,
  ): Promise<MoviesResponseDto> {
    return this.tmdbService.discoverMovies(query);
  }

  @Get('movie/:id')
  async getMovieDetails(
    @Param('id') id: number,
  ): Promise<MovieDetailsResponseDto> {
    return this.tmdbService.movieDetails(id);
  }
}
