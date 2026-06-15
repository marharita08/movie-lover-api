import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import { Language } from 'src/entities';

import { Public } from '../auth/decorators';

import {
  DiscoverMoviesQueryDto,
  MovieDetailsResponseDto,
  MoviesResponseDto,
  MultiSearchQueryDto,
  MultiSearchResponseDto,
  PersonResponseDto,
  TvShowDetailsResponseDto,
} from './dto';
import { TmdbService } from './tmdb.service';

@Controller('tmdb')
@Public()
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
    @Query('language') language?: Language,
  ): Promise<MovieDetailsResponseDto> {
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('Invalid movie ID');
    }
    return this.tmdbService.movieDetails(idNumber, language);
  }

  @Get('tv/:id')
  async getTvShowDetails(
    @Param('id') id: string,
    @Query('language') language?: Language,
  ): Promise<TvShowDetailsResponseDto> {
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('Invalid TV show ID');
    }
    return this.tmdbService.getTVShowDetails(idNumber, language);
  }

  @Get('person/:id')
  async getPerson(
    @Param('id') id: string,
    @Query('language') language?: Language,
  ): Promise<PersonResponseDto> {
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('Invalid person ID');
    }
    return this.tmdbService.getPerson(idNumber, language);
  }

  @Get('search/multi')
  async multiSearch(
    @Query() query: MultiSearchQueryDto,
  ): Promise<MultiSearchResponseDto> {
    return this.tmdbService.multiSearch(query);
  }
}
