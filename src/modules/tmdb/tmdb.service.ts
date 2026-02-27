import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';

import { MediaType } from 'src/entities';
import { toSnakeCase } from 'src/utils';

import {
  CastMemberDto,
  CreditsResponseDto,
  CrewMemberDto,
  DiscoverMoviesQueryDto,
  MovieDto,
  PersonResponseDto,
  TmdbCreditsResponseDto,
  TmdbFindResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
  TmdbPersonResponseDto,
  TmdbTvShowDetailsResponseDto,
  TvShowDetailsResponseDto,
  TvShowResponseDto,
} from './dto';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

@Injectable()
export class TmdbService {
  private readonly http: AxiosInstance;
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

  async discoverMovies(query: DiscoverMoviesQueryDto) {
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
    try {
      const { data } = await this.http.get<TmdbMovieDetailsResponseDto>(
        `/movie/${id}`,
      );
      return this.tmdbResponseMapperService.mapMovieDetails(data);
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

  async findMediaByImdbId(imdbId: string): Promise<{
    type: MediaType;
    data: MovieDto | TvShowResponseDto;
  } | null> {
    try {
      const { data } = await this.http.get<TmdbFindResponseDto>(
        `/find/${imdbId}`,
        {
          params: { external_source: 'imdb_id' },
        },
      );

      if (data.movie_results?.length > 0) {
        return {
          type: MediaType.MOVIE,
          data: this.tmdbResponseMapperService.mapMovie(data.movie_results[0]),
        };
      }

      if (data.tv_results?.length > 0) {
        return {
          type: MediaType.TV,
          data: this.tmdbResponseMapperService.mapTvShow(data.tv_results[0]),
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error finding media by IMDB ID ${imdbId}:`, error);
      return null;
    }
  }

  async getTVShowDetails(tvShowId: number): Promise<TvShowDetailsResponseDto> {
    try {
      const { data } = await this.http.get<TmdbTvShowDetailsResponseDto>(
        `/tv/${tvShowId}`,
        {
          params: { append_to_response: 'external_ids' },
        },
      );
      return this.tmdbResponseMapperService.mapTvShowDetails(data);
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
    try {
      const { data } = await this.http.get<TmdbCreditsResponseDto>(
        `/movie/${movieId}/credits`,
      );
      return this.tmdbResponseMapperService.mapCredits(data);
    } catch (error) {
      this.logger.error(`Error getting movie credits ${movieId}:`, error);
      return null;
    }
  }

  async getTVShowCredits(tvShowId: number): Promise<CreditsResponseDto | null> {
    try {
      const { data } = await this.http.get<TmdbCreditsResponseDto>(
        `/tv/${tvShowId}/aggregate_credits`,
      );
      return this.tmdbResponseMapperService.mapCredits(data);
    } catch (error) {
      this.logger.error(`Error getting TV show credits ${tvShowId}:`, error);
      return null;
    }
  }

  async getPerson(personId: number): Promise<PersonResponseDto> {
    try {
      const { data } = await this.http.get<TmdbPersonResponseDto>(
        `/person/${personId}`,
      );
      return this.tmdbResponseMapperService.mapPerson(data);
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
}
