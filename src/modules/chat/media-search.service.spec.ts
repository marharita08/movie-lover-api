import { Test, TestingModule } from '@nestjs/testing';

import { Language, MediaType } from 'src/entities';

import { TmdbService } from '../tmdb/tmdb.service';

import { MediaSearchService } from './media-search.service';

const mockTmdbService = () => ({
  searchMovies: jest.fn(),
  searchTVShows: jest.fn(),
});

const makeMovieResult = (overrides = {}) => ({
  id: 123,
  title: 'Inception',
  posterPath: '/poster.jpg',
  releaseDate: '2010-07-16',
  ...overrides,
});

const makeTvResult = (overrides = {}) => ({
  id: 456,
  name: 'Breaking Bad',
  posterPath: '/tv-poster.jpg',
  firstAirDate: '2008-01-20',
  ...overrides,
});

const language = Language.ENGLISH;

describe('MediaSearchService', () => {
  let service: MediaSearchService;
  let tmdbService: jest.Mocked<TmdbService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaSearchService,
        { provide: TmdbService, useFactory: mockTmdbService },
      ],
    }).compile();

    service = module.get(MediaSearchService);
    tmdbService = module.get(TmdbService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('resolveMediaItem', () => {
    it('should throw for unknown media type', async () => {
      await expect(
        service.resolveMediaItem(
          {
            title: 'Test',
            original_title: 'Test',
            year: 2020,
            type: 'unknown' as MediaType,
          },
          language,
        ),
      ).rejects.toThrow('Unknown media type');
    });
  });

  describe('resolveMovie', () => {
    it('should return movie when found with original_title and year on first attempt', async () => {
      const movie = makeMovieResult();

      tmdbService.searchMovies.mockResolvedValue({ results: [movie] } as never);

      const result = await service.resolveMediaItem(
        {
          title: 'Inception',
          original_title: 'Inception',
          year: 2010,
          type: MediaType.MOVIE,
        },
        language,
      );

      expect(tmdbService.searchMovies).toHaveBeenCalledTimes(1);
      expect(tmdbService.searchMovies).toHaveBeenCalledWith({
        query: 'Inception',
        year: 2010,
        language,
      });
      expect(result).toEqual({
        type: MediaType.MOVIE,
        id: 123,
        title: 'Inception',
        posterPath: '/poster.jpg',
      });
    });

    it('should fall back to next search when year match fails', async () => {
      const wrongYearMovie = makeMovieResult({ releaseDate: '1990-01-01' });
      const correctMovie = makeMovieResult({
        id: 200,
        releaseDate: '2010-07-16',
      });

      tmdbService.searchMovies
        .mockResolvedValueOnce({ results: [wrongYearMovie] } as never)
        .mockResolvedValueOnce({ results: [correctMovie] } as never);

      const result = await service.resolveMediaItem(
        {
          title: 'Inception',
          original_title: 'Inception',
          year: 2010,
          type: MediaType.MOVIE,
        },
        language,
      );

      expect(tmdbService.searchMovies).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(200);
    });

    it('should fall back to first result when no year match on yearless search', async () => {
      const movie = makeMovieResult({ releaseDate: '1990-01-01' });

      // all year-based searches return empty, yearless search returns mismatch → fallback to [0]
      tmdbService.searchMovies
        .mockResolvedValueOnce({ results: [] } as never) // originalTitle + year
        .mockResolvedValueOnce({ results: [] } as never) // title + year
        .mockResolvedValueOnce({ results: [] } as never) // originalTitle no year
        .mockResolvedValueOnce({ results: [movie] } as never); // title no year

      const result = await service.resolveMediaItem(
        {
          title: 'Inception',
          original_title: 'Inception',
          year: 2010,
          type: MediaType.MOVIE,
        },
        language,
      );

      expect(result.id).toBe(123);
    });

    it('should throw when all search attempts return no results', async () => {
      tmdbService.searchMovies.mockResolvedValue({ results: [] } as never);

      await expect(
        service.resolveMediaItem(
          {
            title: 'Unknown',
            original_title: 'Unknown',
            year: 2020,
            type: MediaType.MOVIE,
          },
          language,
        ),
      ).rejects.toThrow('Movie not found: Unknown (2020)');
    });

    it('should skip tmdb error and try next search in sequence', async () => {
      const movie = makeMovieResult();

      tmdbService.searchMovies
        .mockRejectedValueOnce(new Error('TMDB error'))
        .mockResolvedValueOnce({ results: [movie] } as never);

      const result = await service.resolveMediaItem(
        {
          title: 'Inception',
          original_title: 'Inception',
          year: 2010,
          type: MediaType.MOVIE,
        },
        language,
      );

      expect(result.id).toBe(123);
    });
  });

  describe('resolveTvShow', () => {
    it('should return TV show when found with year match', async () => {
      const show = makeTvResult();

      tmdbService.searchTVShows.mockResolvedValue({ results: [show] } as never);

      const result = await service.resolveMediaItem(
        {
          title: 'Breaking Bad',
          original_title: 'Breaking Bad',
          year: 2008,
          type: MediaType.TV,
        },
        language,
      );

      expect(result).toEqual({
        type: MediaType.TV,
        id: 456,
        title: 'Breaking Bad',
        posterPath: '/tv-poster.jpg',
      });
    });

    it('should throw when all TV search attempts fail', async () => {
      tmdbService.searchTVShows.mockResolvedValue({ results: [] } as never);

      await expect(
        service.resolveMediaItem(
          {
            title: 'Unknown Show',
            original_title: 'Unknown Show',
            year: null,
            type: MediaType.TV,
          },
          language,
        ),
      ).rejects.toThrow('TV show not found: Unknown Show (null)');
    });
  });

  describe('buildSearchSequence', () => {
    it('should build 4-step sequence when original_title and year are both present', async () => {
      tmdbService.searchMovies.mockResolvedValue({ results: [] } as never);

      await expect(
        service.resolveMediaItem(
          {
            title: 'Title',
            original_title: 'Original',
            year: 2020,
            type: MediaType.MOVIE,
          },
          language,
        ),
      ).rejects.toThrow();

      const queries = tmdbService.searchMovies.mock.calls.map((c) => ({
        query: c[0].query,
        year: c[0].year,
      }));

      expect(queries).toEqual([
        { query: 'Original', year: 2020 },
        { query: 'Title', year: 2020 },
        { query: 'Original', year: undefined },
        { query: 'Title', year: undefined },
      ]);
    });

    it('should build 2-step sequence when only year is present (no original_title)', async () => {
      tmdbService.searchMovies.mockResolvedValue({ results: [] } as never);

      await expect(
        service.resolveMediaItem(
          {
            title: 'Title',
            original_title: null,
            year: 2020,
            type: MediaType.MOVIE,
          },
          language,
        ),
      ).rejects.toThrow();

      expect(tmdbService.searchMovies).toHaveBeenCalledTimes(2);
      expect(tmdbService.searchMovies.mock.calls[0][0]).toMatchObject({
        query: 'Title',
        year: 2020,
      });
      expect(tmdbService.searchMovies.mock.calls[1][0]).toMatchObject({
        query: 'Title',
        year: undefined,
      });
    });

    it('should build 1-step sequence when neither original_title nor year are present', async () => {
      tmdbService.searchMovies.mockResolvedValue({ results: [] } as never);

      await expect(
        service.resolveMediaItem(
          {
            title: 'Title',
            original_title: null,
            year: null,
            type: MediaType.MOVIE,
          },
          language,
        ),
      ).rejects.toThrow();

      expect(tmdbService.searchMovies).toHaveBeenCalledTimes(1);
      expect(tmdbService.searchMovies.mock.calls[0][0]).toMatchObject({
        query: 'Title',
        year: undefined,
      });
    });
  });

  describe('isYearMatch', () => {
    const movieWithDate = (releaseDate: string) =>
      makeMovieResult({ releaseDate });

    it('should accept result within 3-year tolerance', async () => {
      tmdbService.searchMovies.mockResolvedValue({
        results: [movieWithDate('2012-01-01')],
      } as never);

      const result = await service.resolveMediaItem(
        {
          title: 'Inception',
          original_title: null,
          year: 2010,
          type: MediaType.MOVIE,
        },
        language,
      );

      expect(result.id).toBe(123);
    });

    it('should reject result outside 3-year tolerance when year-based search', async () => {
      tmdbService.searchMovies
        .mockResolvedValueOnce({
          results: [movieWithDate('2015-01-01')],
        } as never)
        .mockResolvedValueOnce({
          results: [movieWithDate('2010-01-01')],
        } as never);

      const result = await service.resolveMediaItem(
        {
          title: 'Inception',
          original_title: null,
          year: 2010,
          type: MediaType.MOVIE,
        },
        language,
      );

      expect(tmdbService.searchMovies).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(123);
    });
  });
});
