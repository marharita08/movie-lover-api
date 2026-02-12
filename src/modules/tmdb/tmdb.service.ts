import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendQueryParams } from 'src/utils';

import {
  DiscoverMoviesQueryDto,
  MoviesResponseDto,
  TMDBMoviesResponseDto,
} from './dto';

@Injectable()
export class TmdbService {
  private readonly options: RequestInit;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
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

  private mapMoviesResponse(data: TMDBMoviesResponseDto): MoviesResponseDto {
    return {
      page: data.page,
      results: data.results.map((movie) => ({
        adult: movie.adult,
        backdropPath: movie.backdrop_path,
        genreIds: movie.genre_ids,
        id: movie.id,
        originalLanguage: movie.original_language,
        originalTitle: movie.original_title,
        overview: movie.overview,
        popularity: movie.popularity,
        posterPath: movie.poster_path,
        releaseDate: movie.release_date,
        title: movie.title,
        video: movie.video,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
      })),
      totalPages: data.total_pages,
      totalResults: data.total_results,
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
    return this.mapMoviesResponse(data);
  }
}
