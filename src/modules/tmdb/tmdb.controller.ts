import { Controller, Get, Query } from '@nestjs/common';

import { DiscoverMoviesQueryDto, MoviesResponseDto } from './dto';
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
}
