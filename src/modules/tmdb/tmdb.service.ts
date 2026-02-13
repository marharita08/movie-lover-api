import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendQueryParams } from 'src/utils';

import {
  DiscoverMoviesQueryDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
} from './dto';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

@Injectable()
export class TmdbService {
  private readonly options: RequestInit;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tmdbResponseMapperService: TmdbResponseMapperService,
  ) {
    const token = this.configService.get<string>('TMDB_TOKEN');
    const baseUrl = this.configService.get<string>('TMDB_URL');
    if (!token || !baseUrl) {
      throw new Error('TMDB_TOKEN or TMDB_URL is not set');
    }
    this.baseUrl = baseUrl;
    this.options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
  }

  async discoverMovies(query: DiscoverMoviesQueryDto) {
    const url = new URL(`${this.baseUrl}/discover/movie`);
    appendQueryParams(url, query);
    const response = await fetch(url, this.options);
    if (!response.ok) {
      throw new Error('Failed to fetch movies');
    }
    const data = (await response.json()) as TMDBMoviesResponseDto;
    return this.tmdbResponseMapperService.mapMoviesResponse(data);
  }

  async movieDetails(id: number) {
    const url = new URL(`${this.baseUrl}/movie/${id}`);
    const response = await fetch(url, this.options);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to fetch movies: ${response.status} - ${errorBody}`,
      );
    }
    const data = (await response.json()) as TmdbMovieDetailsResponseDto;
    if (!data) {
      throw new NotFoundException('Movie not found');
    }
    return this.tmdbResponseMapperService.mapMovieDetails(data);
  }
}
