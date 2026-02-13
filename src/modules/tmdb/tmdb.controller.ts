import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

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
    @Param('id') id: string,
  ): Promise<MovieDetailsResponseDto> {
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('Invalid movie ID');
    }
    return this.tmdbService.movieDetails(idNumber);
  }
}
