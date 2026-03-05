import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';
import type { Cache } from 'cache-manager';

import { MediaType } from 'src/entities';
import { toSnakeCase } from 'src/utils';

import {
  CastMemberDto,
  CreditsResponseDto,
  CrewMemberDto,
  DiscoverMoviesQueryDto,
  MovieDetailsResponseDto,
  MoviesResponseDto,
  MultiSearchQueryDto,
  MultiSearchResponseDto,
  PersonResponseDto,
  TmdbCreditsResponseDto,
  TmdbFindResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
  TmdbMultiSearchResponseDto,
  TmdbPersonResponseDto,
  TmdbTvShowDetailsResponseDto,
  TvShowDetailsResponseDto,
} from './dto';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';
import { FindMediaResponseDto } from './dto/find-media-response.dto';

@Injectable()
export class TmdbService {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(TmdbService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly tmdbResponseMapperService: TmdbResponseMapperService,
  ) {
    const token = this.configService.get<string>('TMDB_TOKEN');
    const baseUrl = this.configService.get<string>('TMDB_URL');

    if (!token || !baseUrl) {
      throw new Error('TMDB_TOKEN or TMDB_URL is not set');
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
    });

    this.http = rateLimit(axiosInstance, {
      maxRequests: 40,
      perMilliseconds: 1000,
    });
  }

  async discoverMovies(
    query: DiscoverMoviesQueryDto,
  ): Promise<MoviesResponseDto> {
    const shouldCache = !query.page || query.page <= 5;

    if (!shouldCache) {
      return this.fetchDiscoverMoviesFromApi(query);
    }

    const cacheKey = this.generateCacheKey('discover:movies', query);
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached as MoviesResponseDto;
    }

    const data = await this.fetchDiscoverMoviesFromApi(query);
    await this.cacheManager.set(cacheKey, data, 3600000);

    return data;
  }

  async fetchDiscoverMoviesFromApi(
    query: DiscoverMoviesQueryDto,
  ): Promise<MoviesResponseDto> {
    try {
      const params = this.prepareQueryParams(query);
      const { data } = await this.http.get<TMDBMoviesResponseDto>(
        '/discover/movie',
        { params },
      );
      return this.tmdbResponseMapperService.mapMoviesResponse(data);
    } catch (error) {
      this.logger.error(`Error fetching movies:`, error);
      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : 'Failed to fetch movies',
      );
    }
  }

  async movieDetails(id: number) {
    const cacheKey = `movie:${id}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as MovieDetailsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbMovieDetailsResponseDto>(
        `/movie/${id}`,
      );
      const mapped = this.tmdbResponseMapperService.mapMovieDetails(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error fetching movie details ${id}:`, error);

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException(
          error.response.data?.status_message || 'Movie not found',
        );
      }

      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : 'Failed to fetch movie details',
      );
    }
  }

  async findMediaByImdbId(
    imdbId: string,
  ): Promise<FindMediaResponseDto | null> {
    const cacheKey = `media:${imdbId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as FindMediaResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbFindResponseDto>(
        `/find/${imdbId}`,
        {
          params: { external_source: 'imdb_id' },
        },
      );

      if (data.movie_results?.length > 0) {
        const mapped = {
          type: MediaType.MOVIE,
          data: this.tmdbResponseMapperService.mapMovie(data.movie_results[0]),
        };

        await this.cacheManager.set(cacheKey, mapped);

        return mapped;
      }

      if (data.tv_results?.length > 0) {
        const mapped = {
          type: MediaType.TV,
          data: this.tmdbResponseMapperService.mapTvShow(data.tv_results[0]),
        };

        await this.cacheManager.set(cacheKey, mapped);

        return mapped;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error finding media by IMDB ID ${imdbId}:`, error);
      return null;
    }
  }

  async getTVShowDetails(tvShowId: number): Promise<TvShowDetailsResponseDto> {
    const cacheKey = `tv:${tvShowId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as TvShowDetailsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbTvShowDetailsResponseDto>(
        `/tv/${tvShowId}`,
        {
          params: { append_to_response: 'external_ids' },
        },
      );

      const mapped = this.tmdbResponseMapperService.mapTvShowDetails(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting TV show details ${tvShowId}:`, error);

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException(
          error.response.data?.status_message || 'TV show not found',
        );
      }

      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : 'Failed to fetch tv show details',
      );
    }
  }

  async getMovieCredits(movieId: number): Promise<CreditsResponseDto | null> {
    const cacheKey = `movie-credits:${movieId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as CreditsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbCreditsResponseDto>(
        `/movie/${movieId}/credits`,
      );
      const mapped = this.tmdbResponseMapperService.mapCredits(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting movie credits ${movieId}:`, error);
      return null;
    }
  }

  async getTVShowCredits(tvShowId: number): Promise<CreditsResponseDto | null> {
    const cacheKey = `tv-credits:${tvShowId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as CreditsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbCreditsResponseDto>(
        `/tv/${tvShowId}/aggregate_credits`,
      );
      const mapped = this.tmdbResponseMapperService.mapCredits(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting TV show credits ${tvShowId}:`, error);
      return null;
    }
  }

  async getPerson(personId: number): Promise<PersonResponseDto> {
    const cacheKey = `person:${personId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as PersonResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbPersonResponseDto>(
        `/person/${personId}`,
      );
      const mapped = this.tmdbResponseMapperService.mapPerson(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting person ${personId}:`, error);

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException(
          error.response.data?.status_message || 'Person not found',
        );
      }

      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : 'Failed to get person',
      );
    }
  }

  async multiSearch(
    query: MultiSearchQueryDto,
  ): Promise<MultiSearchResponseDto> {
    try {
      const { data } = await this.http.get<TmdbMultiSearchResponseDto>(
        `/search/multi`,
        {
          params: this.prepareQueryParams(query),
        },
      );
      return this.tmdbResponseMapperService.mapMultiSearch(data);
    } catch (error) {
      this.logger.error(`Error searching for ${query.query}:`, error);
      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : 'Failed to search',
      );
    }
  }

  getTopActors(
    credits: CreditsResponseDto,
    limit: number = 7,
  ): Array<CastMemberDto> {
    if (!credits?.cast) return [];

    return credits.cast
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .slice(0, limit);
  }

  getDirectors(credits: CreditsResponseDto): Array<CrewMemberDto> {
    if (!credits?.crew) return [];

    return credits.crew.filter((person) => person.job === 'Director');
  }

  private prepareQueryParams<T extends object>(query: T): Record<string, any> {
    const params: Record<string, any> = {};

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      const snakeKey = toSnakeCase(key);

      if (Array.isArray(value)) {
        params[snakeKey] = value.join(',');
      } else {
        params[snakeKey] = value;
      }
    });

    return params;
  }

  private generateCacheKey(prefix: string, query: Record<string, any>): string {
    const sortedKeys = Object.keys(query).sort();

    const params = sortedKeys
      .filter((key) => query[key] !== undefined && query[key] !== null)
      .map((key) => `${key}:${query[key]}`)
      .join('|');

    return params ? `${prefix}:${params}` : `${prefix}:default`;
  }
}
