import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';
import type { Cache } from 'cache-manager';

import { tmdbConfig } from 'src/config';
import { TranslationKeys } from 'src/const/translations/keys';
import { Language, MediaType } from 'src/entities';
import { TranslationService } from 'src/modules/translation/translation.service';
import { toSnakeCase } from 'src/utils';

import {
  CastMemberDto,
  CreditsResponseDto,
  CrewMemberDto,
  DiscoverMoviesQueryDto,
  MovieDetailsResponseDto,
  MovieSearchQueryDto,
  MoviesResponseDto,
  MultiSearchQueryDto,
  MultiSearchResponseDto,
  PersonResponseDto,
  TmdbCreditsResponseDto,
  TmdbFindResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
  TmdbMultiSearchResponseDto,
  TmdbPaginatedResponseDto,
  TmdbPersonResponseDto,
  TmdbTvShowDetailsResponseDto,
  TmdbTvShowResponseDto,
  TvShowDetailsResponseDto,
  TvShowResponseDto,
} from './dto';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';
import { FindMediaResponseDto } from './dto/find-media-response.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';
import { TvShowSearchQueryDto } from './dto/tv-show-search-query.dto';

@Injectable()
export class TmdbService {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(TmdbService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(tmdbConfig.KEY)
    private readonly config: ConfigType<typeof tmdbConfig>,
    private readonly tmdbResponseMapperService: TmdbResponseMapperService,
    private readonly i18n: TranslationService,
  ) {
    const axiosInstance = axios.create({
      baseURL: this.config.url,
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${this.config.token}`,
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
    const language = query.language || Language.ENGLISH;
    const shouldCache = !query.page || query.page <= 5;

    const updatedQuery = { ...query, language };

    if (!shouldCache) {
      return this.fetchDiscoverMoviesFromApi(updatedQuery);
    }

    const cacheKey = this.generateCacheKey('discover:movies', updatedQuery);
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached as MoviesResponseDto;
    }

    const data = await this.fetchDiscoverMoviesFromApi(updatedQuery);
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
          : this.i18n.t(TranslationKeys.ERROR_MOVIES_FETCH_FAILED),
      );
    }
  }

  async movieDetails(id: number, language: Language = Language.ENGLISH) {
    const cacheKey = `movie:${id}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as MovieDetailsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbMovieDetailsResponseDto>(
        `/movie/${id}`,
        { params: { language } },
      );
      const mapped = this.tmdbResponseMapperService.mapMovieDetails(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error fetching movie details ${id}:`, error);

      if (
        axios.isAxiosError(error) &&
        error.response?.status === HttpStatus.NOT_FOUND
      ) {
        throw new NotFoundException(
          error.response.data?.status_message ||
            this.i18n.t(TranslationKeys.ERROR_MOVIE_NOT_FOUND),
        );
      }

      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : this.i18n.t(TranslationKeys.ERROR_MOVIE_DETAILS_FETCH_FAILED),
      );
    }
  }

  async findMediaByImdbId(
    imdbId: string,
    language: Language = Language.ENGLISH,
  ): Promise<FindMediaResponseDto | null> {
    const cacheKey = `media:${imdbId}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as FindMediaResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbFindResponseDto>(
        `/find/${imdbId}`,
        {
          params: { external_source: 'imdb_id', language },
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

  async getTVShowDetails(
    tvShowId: number,
    language: Language = Language.ENGLISH,
  ): Promise<TvShowDetailsResponseDto> {
    const cacheKey = `tv:${tvShowId}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as TvShowDetailsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbTvShowDetailsResponseDto>(
        `/tv/${tvShowId}`,
        {
          params: { append_to_response: 'external_ids', language },
        },
      );

      const mapped = this.tmdbResponseMapperService.mapTvShowDetails(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting TV show details ${tvShowId}:`, error);

      if (
        axios.isAxiosError(error) &&
        error.response?.status === HttpStatus.NOT_FOUND
      ) {
        throw new NotFoundException(
          error.response.data?.status_message ||
            this.i18n.t(TranslationKeys.ERROR_TV_SHOW_NOT_FOUND),
        );
      }

      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : this.i18n.t(TranslationKeys.ERROR_TV_SHOW_DETAILS_FETCH_FAILED),
      );
    }
  }

  async getMovieCredits(
    movieId: number,
    language: Language = Language.ENGLISH,
  ): Promise<CreditsResponseDto | null> {
    const cacheKey = `movie-credits:${movieId}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as CreditsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbCreditsResponseDto>(
        `/movie/${movieId}/credits`,
        { params: { language } },
      );
      const mapped = this.tmdbResponseMapperService.mapCredits(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting movie credits ${movieId}:`, error);
      return null;
    }
  }

  async getTVShowCredits(
    tvShowId: number,
    language: Language = Language.ENGLISH,
  ): Promise<CreditsResponseDto | null> {
    const cacheKey = `tv-credits:${tvShowId}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as CreditsResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbCreditsResponseDto>(
        `/tv/${tvShowId}/aggregate_credits`,
        { params: { language } },
      );
      const mapped = this.tmdbResponseMapperService.mapCredits(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting TV show credits ${tvShowId}:`, error);
      return null;
    }
  }

  async getPerson(
    personId: number,
    language: Language = Language.ENGLISH,
  ): Promise<PersonResponseDto> {
    const cacheKey = `person:${personId}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as PersonResponseDto;
    }

    try {
      const { data } = await this.http.get<TmdbPersonResponseDto>(
        `/person/${personId}`,
        { params: { language } },
      );
      const mapped = this.tmdbResponseMapperService.mapPerson(data);

      await this.cacheManager.set(cacheKey, mapped);

      return mapped;
    } catch (error) {
      this.logger.error(`Error getting person ${personId}:`, error);

      if (
        axios.isAxiosError(error) &&
        error.response?.status === HttpStatus.NOT_FOUND
      ) {
        throw new NotFoundException(
          error.response.data?.status_message ||
            this.i18n.t(TranslationKeys.ERROR_PERSON_NOT_FOUND),
        );
      }

      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : this.i18n.t(TranslationKeys.ERROR_PERSON_FETCH_FAILED),
      );
    }
  }

  async multiSearch(
    query: MultiSearchQueryDto,
  ): Promise<MultiSearchResponseDto> {
    const language = query.language || Language.ENGLISH;
    const updatedQuery = { ...query, language };

    try {
      const { data } = await this.http.get<TmdbMultiSearchResponseDto>(
        `/search/multi`,
        {
          params: this.prepareQueryParams(updatedQuery),
        },
      );
      return this.tmdbResponseMapperService.mapMultiSearch(data);
    } catch (error) {
      this.logger.error(`Error searching for ${query.query}:`, error);
      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : this.i18n.t(TranslationKeys.ERROR_SEARCH_FAILED),
      );
    }
  }

  async searchMovies(query: MovieSearchQueryDto): Promise<MoviesResponseDto> {
    const language = query.language || Language.ENGLISH;
    const updatedQuery = { ...query, language };

    try {
      const { data } = await this.http.get<TMDBMoviesResponseDto>(
        `/search/movie`,
        {
          params: this.prepareQueryParams(updatedQuery),
        },
      );
      return this.tmdbResponseMapperService.mapMoviesResponse(data);
    } catch (error) {
      this.logger.error(`Error searching for ${query.query}:`, error);
      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : this.i18n.t(TranslationKeys.ERROR_SEARCH_FAILED),
      );
    }
  }

  async searchTVShows(
    query: TvShowSearchQueryDto,
  ): Promise<PaginatedResponseDto<TvShowResponseDto>> {
    const language = query.language || Language.ENGLISH;
    const updatedQuery = { ...query, language };

    try {
      const { data } = await this.http.get<
        TmdbPaginatedResponseDto<TmdbTvShowResponseDto>
      >(`/search/tv`, {
        params: this.prepareQueryParams(updatedQuery),
      });
      return this.tmdbResponseMapperService.mapTvShows(data);
    } catch (error) {
      this.logger.error(`Error searching for ${query.query}:`, error);
      throw new InternalServerErrorException(
        axios.isAxiosError(error) && error.response?.data?.status_message
          ? error.response.data.status_message
          : this.i18n.t(TranslationKeys.ERROR_SEARCH_FAILED),
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
