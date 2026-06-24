import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import MockAdapter from 'axios-mock-adapter';

import { tmdbConfig } from 'src/config';
import { MediaType } from 'src/entities';
import { TranslationService } from 'src/modules/translation/translation.service';

import { CreditsResponseDto } from './dto';
import { TmdbService } from './tmdb.service';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

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
        {
          provide: tmdbConfig.KEY,
          useValue: {
            token: 'test_token',
            url: 'https://api.themoviedb.org/3',
          },
        },
        { provide: CACHE_MANAGER, useFactory: mockCacheManager },
        {
          provide: TmdbResponseMapperService,
          useFactory: mockTmdbResponseMapperService,
        },
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
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

  describe('discoverMovies', () => {
    const rawData = { results: [], page: 1, total_pages: 1, total_results: 0 };
    const mappedData = { results: [], page: 1, totalPages: 1, totalResults: 0 };

    it('should fetch, cache and return mapped movies response', async () => {
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

    it('should return cached data without hitting API', async () => {
      cacheManager.get.mockResolvedValue(mappedData);

      const result = await service.discoverMovies({ page: 1 } as never);

      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(mappedData);
    });

    it('should not cache pages higher than 5', async () => {
      axiosMock.onGet('/discover/movie').reply(200, rawData);
      tmdbResponseMapperService.mapMoviesResponse.mockReturnValue(mappedData);

      await service.discoverMovies({ page: 6 } as never);

      expect(cacheManager.get).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on API error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/discover/movie').reply(500);

      await expect(service.discoverMovies({} as never)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('movieDetails', () => {
    it('should fetch, cache and return mapped movie details', async () => {
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
      expect(cacheManager.set).toHaveBeenCalledWith(
        'movie:1:en-US',
        mappedData,
      );
      expect(result).toBe(mappedData);
    });

    it('should return cached data without hitting API', async () => {
      const cachedData = { id: 1, title: 'Movie' };
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.movieDetails(1);

      expect(cacheManager.get).toHaveBeenCalledWith('movie:1:en-US');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should throw NotFoundException on 404', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/999').reply(404, { status_message: 'Not found' });

      await expect(service.movieDetails(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1').reply(500);

      await expect(service.movieDetails(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findMediaByImdbId', () => {
    beforeEach(() => {
      cacheManager.get.mockResolvedValue(null);
    });

    it('should return mapped movie when movie_results is not empty', async () => {
      const rawMovie = { id: 1 };
      const mappedMovie = { id: 1, title: 'Movie' };

      axiosMock
        .onGet('/find/tt1234567')
        .reply(200, { movie_results: [rawMovie], tv_results: [] });
      tmdbResponseMapperService.mapMovie.mockReturnValue(mappedMovie as never);

      const result = await service.findMediaByImdbId('tt1234567');

      expect(result).toEqual({ type: MediaType.MOVIE, data: mappedMovie });
      expect(cacheManager.set).toHaveBeenCalledWith('media:tt1234567:en-US', {
        type: MediaType.MOVIE,
        data: mappedMovie,
      });
    });

    it('should return mapped TV show when tv_results is not empty', async () => {
      const rawTvShow = { id: 2 };
      const mappedTvShow = { id: 2, name: 'Show' };

      axiosMock
        .onGet('/find/tt1234567')
        .reply(200, { movie_results: [], tv_results: [rawTvShow] });
      tmdbResponseMapperService.mapTvShow.mockReturnValue(
        mappedTvShow as never,
      );

      const result = await service.findMediaByImdbId('tt1234567');

      expect(result).toEqual({ type: MediaType.TV, data: mappedTvShow });
    });

    it('should return cached data without hitting API', async () => {
      const cachedData = {
        type: MediaType.MOVIE,
        data: { id: 1, title: 'Movie' },
      };
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.findMediaByImdbId('tt1234567');

      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it.each([
      ['no results found', { movie_results: [], tv_results: [] }, 200],
      ['API error', {}, 500],
    ])('should return null when %s', async (_label, responseBody, status) => {
      axiosMock.onGet('/find/tt1234567').reply(status, responseBody);

      expect(await service.findMediaByImdbId('tt1234567')).toBeNull();
    });
  });

  describe('getTVShowDetails', () => {
    it('should fetch, cache and return mapped TV show details', async () => {
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
      expect(cacheManager.set).toHaveBeenCalledWith('tv:1:en-US', mappedData);
      expect(result).toBe(mappedData);
    });

    it('should return cached data without hitting API', async () => {
      const cachedData = { id: 1, name: 'Show' };
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getTVShowDetails(1);

      expect(cacheManager.get).toHaveBeenCalledWith('tv:1:en-US');
      expect(axiosMock.history.get.length).toBe(0);
      expect(result).toBe(cachedData);
    });

    it('should throw NotFoundException on 404', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/999').reply(404, { status_message: 'Not found' });

      await expect(service.getTVShowDetails(999)).rejects.toThrow(
        NotFoundException,
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
    it('should fetch, cache and return mapped credits', async () => {
      const rawCredits = { id: 1, cast: [], crew: [] };
      const mappedCredits = { id: 1, cast: [], crew: [] };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1/credits').reply(200, rawCredits);
      tmdbResponseMapperService.mapCredits.mockReturnValue(mappedCredits);

      const result = await service.getMovieCredits(1);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'movie-credits:1:en-US',
        mappedCredits,
      );
      expect(result).toBe(mappedCredits);
    });

    it('should return cached data without hitting API', async () => {
      const cachedData = { id: 1, cast: [], crew: [] };
      cacheManager.get.mockResolvedValue(cachedData);

      expect(await service.getMovieCredits(1)).toBe(cachedData);
      expect(axiosMock.history.get.length).toBe(0);
    });

    it('should return null on error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/movie/1/credits').reply(500);

      expect(await service.getMovieCredits(1)).toBeNull();
    });
  });

  describe('getTVShowCredits', () => {
    it('should fetch, cache and return mapped credits', async () => {
      const rawCredits = { id: 1, cast: [], crew: [] };
      const mappedCredits = { id: 1, cast: [], crew: [] };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1/aggregate_credits').reply(200, rawCredits);
      tmdbResponseMapperService.mapCredits.mockReturnValue(mappedCredits);

      const result = await service.getTVShowCredits(1);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'tv-credits:1:en-US',
        mappedCredits,
      );
      expect(result).toBe(mappedCredits);
    });

    it('should return cached data without hitting API', async () => {
      const cachedData = { id: 1, cast: [], crew: [] };
      cacheManager.get.mockResolvedValue(cachedData);

      expect(await service.getTVShowCredits(1)).toBe(cachedData);
      expect(axiosMock.history.get.length).toBe(0);
    });

    it('should return null on error', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/tv/1/aggregate_credits').reply(500);

      expect(await service.getTVShowCredits(1)).toBeNull();
    });
  });

  describe('getPerson', () => {
    it('should fetch, cache and return mapped person', async () => {
      const rawPerson = { id: 1, name: 'Actor' };
      const mappedPerson = { id: 1, name: 'Actor' };

      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/person/1').reply(200, rawPerson);
      tmdbResponseMapperService.mapPerson.mockReturnValue(
        mappedPerson as never,
      );

      const result = await service.getPerson(1);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'person:1:en-US',
        mappedPerson,
      );
      expect(result).toBe(mappedPerson);
    });

    it('should return cached data without hitting API', async () => {
      const cachedData = { id: 1, name: 'Actor' };
      cacheManager.get.mockResolvedValue(cachedData);

      expect(await service.getPerson(1)).toBe(cachedData);
      expect(axiosMock.history.get.length).toBe(0);
    });

    it('should throw NotFoundException on 404', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock
        .onGet('/person/999')
        .reply(404, { status_message: 'Not found' });

      await expect(service.getPerson(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      axiosMock.onGet('/person/1').reply(500);

      await expect(service.getPerson(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('multiSearch', () => {
    it('should fetch and return mapped multi-search results', async () => {
      const rawData = {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 1 }],
      };
      const mappedData = {
        page: 1,
        totalPages: 1,
        totalResults: 1,
        results: [{ id: 1 }],
      };

      axiosMock.onGet('/search/multi').reply(200, rawData);
      tmdbResponseMapperService.mapMultiSearch = jest
        .fn()
        .mockReturnValue(mappedData);

      const result = await service.multiSearch({
        query: 'test',
        page: 1,
      } as never);

      expect(tmdbResponseMapperService.mapMultiSearch).toHaveBeenCalledWith(
        rawData,
      );
      expect(result).toBe(mappedData);
    });

    it('should convert camelCase query params to snake_case', async () => {
      axiosMock.onGet('/search/multi').reply((config) => {
        expect(config.params).toMatchObject({
          query: 'test',
          page: 2,
          include_adult: false,
          language: 'en-US',
        });
        return [
          200,
          { page: 1, total_pages: 1, total_results: 0, results: [] },
        ];
      });
      tmdbResponseMapperService.mapMultiSearch = jest.fn().mockReturnValue({});

      await service.multiSearch({
        query: 'test',
        page: 2,
        includeAdult: false,
      } as never);
    });

    it('should throw InternalServerErrorException on API error', async () => {
      axiosMock.onGet('/search/multi').reply(500);

      await expect(
        service.multiSearch({ query: 'test', page: 1 } as never),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getTopActors', () => {
    it('should return top actors sorted by order and limited to specified count', () => {
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

      const result = service.getTopActors(credits, 2);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Actor A');
      expect(result[1].name).toBe('Actor B');
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

      expect(service.getTopActors(credits)).toHaveLength(7);
    });

    it.each([
      ['credits is null', null],
      ['cast is missing', {}],
    ])('should return empty array when %s', (_label, input) => {
      expect(service.getTopActors(input as never)).toEqual([]);
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

    it.each([
      [
        'no directors in crew',
        {
          crew: [
            {
              id: 1,
              name: 'Producer',
              job: 'Producer',
              profilePath: null,
              department: 'Production',
            },
          ],
        },
      ],
      ['credits is null', null],
    ])('should return empty array when %s', (_label, input) => {
      expect(service.getDirectors(input as never)).toEqual([]);
    });
  });
});
