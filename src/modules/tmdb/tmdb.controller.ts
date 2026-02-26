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
  PersonResponseDto,
  TvShowDetailsResponseDto,
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

  @Get('tv/:id')
  async getTvShowDetails(
    @Param('id') id: string,
  ): Promise<TvShowDetailsResponseDto> {
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('Invalid TV show ID');
    }
    return this.tmdbService.getTVShowDetails(idNumber);
  }

  @Get('person/:id')
  async getPerson(@Param('id') id: string): Promise<PersonResponseDto> {
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('Invalid person ID');
    }
    return this.tmdbService.getPerson(idNumber);
  }
}
