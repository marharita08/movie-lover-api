import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaType } from 'src/entities';
import { appendQueryParams } from 'src/utils';

import {
  CreditsResponseDto,
  DiscoverMoviesQueryDto,
  MovieDetailsResponseDto,
  PersonResponseDto,
  TmdbCreditsResponseDto,
  TmdbFindResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
  TmdbPersonResponseDto,
  TmdbTvShowDetailsResponseDto,
  TvShowDetailsResponseDto,
} from './dto';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

@Injectable()
export class TmdbService {
  private readonly options: RequestInit;
  private readonly baseUrl: string;
  private readonly logger = new Logger(TmdbService.name);

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
      if (response.status === 404) {
        throw new NotFoundException((await response.json()).status_message);
      }
      const errorBody = await response.text();
      throw new Error(
        `Failed to fetch movies: ${response.status} - ${errorBody}`,
      );
    }
    const data = (await response.json()) as TmdbMovieDetailsResponseDto;
    return this.tmdbResponseMapperService.mapMovieDetails(data);
  }

  async findMediaByImdbId(imdbId: string): Promise<{
    type: MediaType;
    data: MovieDetailsResponseDto | TvShowDetailsResponseDto;
  } | null> {
    try {
      const url = new URL(`${this.baseUrl}/find/${imdbId}`);
      url.searchParams.append('external_source', 'imdb_id');

      const response = await fetch(url, this.options);
      if (!response.ok) {
        this.logger.warn(`Failed to find media by IMDB ID ${imdbId}`);
        return null;
      }

      const data = (await response.json()) as TmdbFindResponseDto;

      if (data.movie_results?.length > 0) {
        return {
          type: MediaType.MOVIE,
          data: this.tmdbResponseMapperService.mapMovieDetails(
            data.movie_results[0],
          ),
        };
      }

      if (data.tv_results?.length > 0) {
        const tvShow = data.tv_results[0];
        return {
          type: MediaType.TV,
          data: this.tmdbResponseMapperService.mapTvShowDetails(tvShow),
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error finding media by IMDB ID ${imdbId}:`, error);
      return null;
    }
  }

  async getTVShowDetails(
    tvShowId: number,
  ): Promise<TvShowDetailsResponseDto | null> {
    try {
      const url = new URL(`${this.baseUrl}/tv/${tvShowId}`);
      const response = await fetch(url, this.options);

      if (!response.ok) {
        this.logger.warn(`Failed to get TV show details for ${tvShowId}`);
        return null;
      }

      const tvShow = (await response.json()) as TmdbTvShowDetailsResponseDto;

      return this.tmdbResponseMapperService.mapTvShowDetails(tvShow);
    } catch (error) {
      this.logger.error(`Error getting TV show details ${tvShowId}:`, error);
      return null;
    }
  }

  async getMovieCredits(movieId: number): Promise<CreditsResponseDto | null> {
    try {
      const url = new URL(`${this.baseUrl}/movie/${movieId}/credits`);
      const response = await fetch(url, this.options);

      if (!response.ok) {
        this.logger.warn(`Failed to get movie credits for ${movieId}`);
        return null;
      }
      const credits = (await response.json()) as TmdbCreditsResponseDto;
      return this.tmdbResponseMapperService.mapCredits(credits);
    } catch (error) {
      this.logger.error(`Error getting movie credits ${movieId}:`, error);
      return null;
    }
  }

  async getTVShowCredits(tvShowId: number): Promise<CreditsResponseDto | null> {
    try {
      const url = new URL(`${this.baseUrl}/tv/${tvShowId}/aggregate_credits`);
      const response = await fetch(url, this.options);

      if (!response.ok) {
        this.logger.warn(`Failed to get TV show credits for ${tvShowId}`);
        return null;
      }
      const credits = (await response.json()) as TmdbCreditsResponseDto;
      return this.tmdbResponseMapperService.mapCredits(credits);
    } catch (error) {
      this.logger.error(`Error getting TV show credits ${tvShowId}:`, error);
      return null;
    }
  }

  async getPerson(personId: number): Promise<PersonResponseDto | null> {
    try {
      const url = new URL(`${this.baseUrl}/person/${personId}`);
      const response = await fetch(url, this.options);

      if (!response.ok) {
        this.logger.warn(`Failed to get person details for ${personId}`);
        return null;
      }
      const person = (await response.json()) as TmdbPersonResponseDto;
      return this.tmdbResponseMapperService.mapPerson(person);
    } catch (error) {
      this.logger.error(`Error getting person ${personId}:`, error);
      return null;
    }
  }

  getTopActors(
    credits: CreditsResponseDto,
    limit: number = 5,
  ): Array<{ id: number; name: string; profilePath: string | null }> {
    if (!credits?.cast) return [];

    return credits.cast
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .slice(0, limit);
  }

  getDirectors(
    credits: CreditsResponseDto,
  ): Array<{ id: number; name: string; profilePath: string | null }> {
    if (!credits?.crew) return [];

    return credits.crew.filter((person) => person.job === 'Director');
  }
}
