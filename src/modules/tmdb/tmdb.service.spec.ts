import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import MockAdapter from 'axios-mock-adapter';

import { MediaType } from 'src/entities';

import { CreditsResponseDto } from './dto';
import { TmdbService } from './tmdb.service';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

const mockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    const config: Record<string, string> = {
      TMDB_TOKEN: 'test_token',
      TMDB_URL: 'https://api.themoviedb.org/3',
    };
    return config[key];
  }),
});

const mockCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  stores: [] as any,
});

const mockTmdbResponseMapperService = () => ({
  mapMoviesResponse: jest.fn(),
  mapMovieDetails: jest.fn(),
  mapTvShowDetails: jest.fn(),
  mapCredits: jest.fn(),
  mapPerson: jest.fn(),
  mapMovie: jest.fn(),
  mapTvShow: jest.fn(),
  mapMultiSearch: jest.fn(),
});

describe('TmdbService', () => {
  let service: TmdbService;
  let tmdbResponseMapperService: jest.Mocked<TmdbResponseMapperService>;
  let cacheManager: any;
  let axiosMock: MockAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbService,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: CACHE_MANAGER, useFactory: mockCacheManager },
        {
          provide: TmdbResponseMapperService,
          useFactory: mockTmdbResponseMapperService,
        },
      ],
    }).compile();

    service = module.get(TmdbService);
    tmdbResponseMapperService = module.get(TmdbResponseMapperService);
    cacheManager = module.get(CACHE_MANAGER);

    axiosMock = new MockAdapter(service['http']);
  });

  afterEach(() => {
    axiosMock.reset();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw if TMDB_TOKEN or TMDB_URL is missing', async () => {
      const module = Test.createTestingModule({
        providers: [
          TmdbService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useFactory: mockCacheManager },
          {
            provide: TmdbResponseMapperService,
            useFactory: mockTmdbResponseMapperService,
          },
        ],
      });

      await expect(module.compile()).rejects.toThrow(
        'TMDB_TOKEN or TMDB_URL is not set',
      );
    });
  });

  describe('discoverMovies', () => {
    it('should fetch and return mapped movies response', async () => {
      const rawData = {
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
      };
      const mappedData = {
        results: [],
        page: 1,
        totalPages: 1,
        totalResults: 0,
      };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/discover/movie').reply(200, rawData);
      tmdbResponseMapperService.mapMoviesResponse.mockReturnValue(mappedData);

      const result = await service.discoverMovies({ page: 1 } as never);

      expect(tmdbResponseMapperService.mapMoviesResponse).toHaveBeenCalledWith(
        rawData,
      );
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result).toBe(mappedData);
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        results: [],
        page: 1,
        totalPages: 1,
        totalResults: 0,
      };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.discoverMovies({ page: 1 } as never);

      expect(cacheManager.get).toHaveBeenCalled();
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should not cache pages higher than 5', async () => {
      const rawData = {
        results: [],
        page: 6,
        total_pages: 10,
        total_results: 100,
      };
      const mappedData = {
        results: [],
        page: 6,
        totalPages: 10,
        totalResults: 100,
      };

      axiosMock.onGet('/discover/movie').reply(200, rawData);
      tmdbResponseMapperService.mapMoviesResponse.mockReturnValue(mappedData);

      const result = await service.discoverMovies({ page: 6 } as never);

      expect(cacheManager.get).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
      expect(result).toBe(mappedData);
    });

    it('should throw InternalServerErrorException if response fails', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/discover/movie').reply(500, {
        status_message: 'Internal Server Error',
      });

      await expect(service.discoverMovies({} as never)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on network error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/discover/movie').networkError();

      await expect(service.discoverMovies({} as never)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('movieDetails', () => {
    it('should fetch and return mapped movie details', async () => {
      const rawData = { id: 1 };
      const mappedData = { id: 1, title: 'Movie' };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1').reply(200, rawData);
      tmdbResponseMapperService.mapMovieDetails.mockReturnValue(
        mappedData as never,
      );

      const result = await service.movieDetails(1);

      expect(tmdbResponseMapperService.mapMovieDetails).toHaveBeenCalledWith(
        rawData,
      );
      expect(cacheManager.set).toHaveBeenCalledWith('movie:1', mappedData);
      expect(result).toBe(mappedData);
    });

    it('should return cached data if available', async () => {
      const cachedData = { id: 1, title: 'Movie' };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.movieDetails(1);

      expect(cacheManager.get).toHaveBeenCalledWith('movie:1');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should throw NotFoundException on 404', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/999').reply(404, {
        status_message: 'Movie not found',
      });

      await expect(service.movieDetails(999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.movieDetails(999)).rejects.toThrow(
        'Movie not found',
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1').reply(500, {
        status_message: 'Server error',
      });

      await expect(service.movieDetails(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on network error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1').networkError();

      await expect(service.movieDetails(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findMediaByImdbId', () => {
    it('should return mapped movie if movie_results is not empty', async () => {
      const rawMovie = { id: 1 };
      const mappedMovie = { id: 1, title: 'Movie' };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/find/tt1234567').reply(200, {
        movie_results: [rawMovie],
        tv_results: [],
      });
      tmdbResponseMapperService.mapMovie.mockReturnValue(mappedMovie as never);

      const result = await service.findMediaByImdbId('tt1234567');

      expect(tmdbResponseMapperService.mapMovie).toHaveBeenCalledWith(rawMovie);
      expect(cacheManager.set).toHaveBeenCalledWith('media:tt1234567', {
        type: MediaType.MOVIE,
        data: mappedMovie,
      });
      expect(result).toEqual({ type: MediaType.MOVIE, data: mappedMovie });
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        type: MediaType.MOVIE,
        data: { id: 1, title: 'Movie' },
      };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.findMediaByImdbId('tt1234567');

      expect(cacheManager.get).toHaveBeenCalledWith('media:tt1234567');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should return mapped tv show if tv_results is not empty', async () => {
      const rawTvShow = { id: 2 };
      const mappedTvShow = { id: 2, name: 'Show' };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/find/tt1234567').reply(200, {
        movie_results: [],
        tv_results: [rawTvShow],
      });
      tmdbResponseMapperService.mapTvShow.mockReturnValue(
        mappedTvShow as never,
      );

      const result = await service.findMediaByImdbId('tt1234567');

      expect(tmdbResponseMapperService.mapTvShow).toHaveBeenCalledWith(
        rawTvShow,
      );
      expect(cacheManager.set).toHaveBeenCalledWith('media:tt1234567', {
        type: MediaType.TV,
        data: mappedTvShow,
      });
      expect(result).toEqual({ type: MediaType.TV, data: mappedTvShow });
    });

    it('should return null if no results found', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/find/tt1234567').reply(200, {
        movie_results: [],
        tv_results: [],
      });

      const result = await service.findMediaByImdbId('tt1234567');

      expect(result).toBeNull();
    });

    it('should return null if response fails', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/find/tt1234567').reply(500);

      const result = await service.findMediaByImdbId('tt1234567');

      expect(result).toBeNull();
    });

    it('should return null if network error occurs', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/find/tt1234567').networkError();

      const result = await service.findMediaByImdbId('tt1234567');

      expect(result).toBeNull();
    });
  });

  describe('getTVShowDetails', () => {
    it('should fetch and return mapped tv show details', async () => {
      const rawData = { id: 1 };
      const mappedData = { id: 1, name: 'Show' };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1').reply(200, rawData);
      tmdbResponseMapperService.mapTvShowDetails.mockReturnValue(
        mappedData as never,
      );

      const result = await service.getTVShowDetails(1);

      expect(tmdbResponseMapperService.mapTvShowDetails).toHaveBeenCalledWith(
        rawData,
      );
      expect(cacheManager.set).toHaveBeenCalledWith('tv:1', mappedData);
      expect(result).toBe(mappedData);
    });

    it('should return cached data if available', async () => {
      const cachedData = { id: 1, name: 'Show' };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getTVShowDetails(1);

      expect(cacheManager.get).toHaveBeenCalledWith('tv:1');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should throw NotFoundException on 404', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/999').reply(404, {
        status_message: 'TV show not found',
      });

      await expect(service.getTVShowDetails(999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getTVShowDetails(999)).rejects.toThrow(
        'TV show not found',
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1').reply(500);

      await expect(service.getTVShowDetails(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getMovieCredits', () => {
    it('should fetch and return mapped credits', async () => {
      const rawCredits = { id: 1, cast: [], crew: [] };
      const mappedCredits = { id: 1, cast: [], crew: [] };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1/credits').reply(200, rawCredits);
      tmdbResponseMapperService.mapCredits.mockReturnValue(mappedCredits);

      const result = await service.getMovieCredits(1);

      expect(tmdbResponseMapperService.mapCredits).toHaveBeenCalledWith(
        rawCredits,
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        'movie-credits:1',
        mappedCredits,
      );
      expect(result).toBe(mappedCredits);
    });

    it('should return cached data if available', async () => {
      const cachedData = { id: 1, cast: [], crew: [] };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getMovieCredits(1);

      expect(cacheManager.get).toHaveBeenCalledWith('movie-credits:1');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should return null if response fails', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1/credits').reply(500);

      const result = await service.getMovieCredits(1);

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1/credits').networkError();

      const result = await service.getMovieCredits(1);

      expect(result).toBeNull();
    });
  });

  describe('getTVShowCredits', () => {
    it('should fetch and return mapped credits', async () => {
      const rawCredits = { id: 1, cast: [], crew: [] };
      const mappedCredits = { id: 1, cast: [], crew: [] };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1/aggregate_credits').reply(200, rawCredits);
      tmdbResponseMapperService.mapCredits.mockReturnValue(mappedCredits);

      const result = await service.getTVShowCredits(1);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'tv-credits:1',
        mappedCredits,
      );
      expect(result).toBe(mappedCredits);
    });

    it('should return cached data if available', async () => {
      const cachedData = { id: 1, cast: [], crew: [] };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getTVShowCredits(1);

      expect(cacheManager.get).toHaveBeenCalledWith('tv-credits:1');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should return null if response fails', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1/aggregate_credits').reply(500);

      const result = await service.getTVShowCredits(1);

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1/aggregate_credits').networkError();

      const result = await service.getTVShowCredits(1);

      expect(result).toBeNull();
    });
  });

  describe('getPerson', () => {
    it('should fetch and return mapped person', async () => {
      const rawPerson = { id: 1, name: 'Actor' };
      const mappedPerson = { id: 1, name: 'Actor' };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/person/1').reply(200, rawPerson);
      tmdbResponseMapperService.mapPerson.mockReturnValue(
        mappedPerson as never,
      );

      const result = await service.getPerson(1);

      expect(tmdbResponseMapperService.mapPerson).toHaveBeenCalledWith(
        rawPerson,
      );
      expect(cacheManager.set).toHaveBeenCalledWith('person:1', mappedPerson);
      expect(result).toBe(mappedPerson);
    });

    it('should return cached data if available', async () => {
      const cachedData = { id: 1, name: 'Actor' };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getPerson(1);

      expect(cacheManager.get).toHaveBeenCalledWith('person:1');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should throw NotFoundException on 404', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/person/999').reply(404, {
        status_message: 'Person not found',
      });

      await expect(service.getPerson(999)).rejects.toThrow(NotFoundException);
      await expect(service.getPerson(999)).rejects.toThrow('Person not found');
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/person/1').reply(500);

      await expect(service.getPerson(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getTopActors', () => {
    it('should return top actors sorted by order', () => {
      const credits = {
        cast: [
          {
            id: 3,
            name: 'Actor C',
            order: 2,
            profilePath: null,
            character: '',
          },
          {
            id: 1,
            name: 'Actor A',
            order: 0,
            profilePath: null,
            character: '',
          },
          {
            id: 2,
            name: 'Actor B',
            order: 1,
            profilePath: null,
            character: '',
          },
        ],
      } as CreditsResponseDto;

      const result = service.getTopActors(credits, 3);

      expect(result[0].name).toBe('Actor A');
      expect(result[1].name).toBe('Actor B');
      expect(result[2].name).toBe('Actor C');
    });

    it('should return only the specified limit of actors', () => {
      const credits = {
        cast: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          name: `Actor ${i}`,
          order: i,
          profilePath: null,
          character: '',
        })),
      } as CreditsResponseDto;

      const result = service.getTopActors(credits, 3);

      expect(result).toHaveLength(3);
    });

    it('should return 7 actors by default', () => {
      const credits = {
        cast: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          name: `Actor ${i}`,
          order: i,
          profilePath: null,
          character: '',
        })),
      } as CreditsResponseDto;

      const result = service.getTopActors(credits);

      expect(result).toHaveLength(7);
    });

    it('should return empty array if credits is null', () => {
      expect(service.getTopActors(null as never)).toEqual([]);
    });

    it('should return empty array if cast is missing', () => {
      expect(service.getTopActors({} as never)).toEqual([]);
    });
  });

  describe('getDirectors', () => {
    it('should return only crew members with job Director', () => {
      const credits = {
        crew: [
          {
            id: 1,
            name: 'Director A',
            job: 'Director',
            profilePath: null,
            department: 'Directing',
          },
          {
            id: 2,
            name: 'Producer B',
            job: 'Producer',
            profilePath: null,
            department: 'Production',
          },
          {
            id: 3,
            name: 'Director C',
            job: 'Director',
            profilePath: null,
            department: 'Directing',
          },
        ],
      } as CreditsResponseDto;

      const result = service.getDirectors(credits);

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.job === 'Director')).toBe(true);
    });

    it('should return empty array if no directors found', () => {
      const credits = {
        crew: [
          {
            id: 1,
            name: 'Producer',
            job: 'Producer',
            profilePath: null,
            department: 'Production',
          },
        ],
      } as CreditsResponseDto;

      expect(service.getDirectors(credits)).toEqual([]);
    });

    it('should return empty array if credits is null', () => {
      expect(service.getDirectors(null as never)).toEqual([]);
    });
  });

  describe('multiSearch', () => {
    it('should fetch and return mapped multi-search results', async () => {
      const query = { query: 'test search', page: 1 };
      const rawData = {
        page: 1,
        total_pages: 5,
        total_results: 50,
        results: [
          {
            id: 1,
            media_type: 'movie',
            title: 'Test Movie',
          },
        ],
      };
      const mappedData = {
        page: 1,
        totalPages: 5,
        totalResults: 50,
        results: [
          {
            id: 1,
            mediaType: 'movie',
            title: 'Test Movie',
          },
        ],
      };

      axiosMock.onGet('/search/multi').reply(200, rawData);
      tmdbResponseMapperService.mapMultiSearch = jest
        .fn()
        .mockReturnValue(mappedData);

      const result = await service.multiSearch(query as never);

      expect(tmdbResponseMapperService.mapMultiSearch).toHaveBeenCalledWith(
        rawData,
      );
      expect(result).toBe(mappedData);
    });

    it('should throw InternalServerErrorException on API error', async () => {
      const query = { query: 'test', page: 1 };

      axiosMock.onGet('/search/multi').reply(500, {
        status_message: 'Server error',
      });

      await expect(service.multiSearch(query as never)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on network error', async () => {
      const query = { query: 'test', page: 1 };

      axiosMock.onGet('/search/multi').networkError();

      await expect(service.multiSearch(query as never)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should properly format query parameters', async () => {
      const query = { query: 'test search', page: 2, includeAdult: false };
      const rawData = {
        page: 2,
        total_pages: 1,
        total_results: 10,
        results: [],
      };

      axiosMock.onGet('/search/multi').reply((config) => {
        expect(config.params).toEqual({
          query: 'test search',
          page: 2,
          include_adult: false,
        });
        return [200, rawData];
      });

      tmdbResponseMapperService.mapMultiSearch = jest.fn().mockReturnValue({
        page: 2,
        totalPages: 1,
        totalResults: 10,
        results: [],
      });

      await service.multiSearch(query as never);

      expect(tmdbResponseMapperService.mapMultiSearch).toHaveBeenCalled();
    });
  });
});
