import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MediaItem, MediaType, PersonRole } from 'src/entities';
import { MediaPersonService } from 'src/modules/media-person/media-person.service';
import { TmdbService } from 'src/modules/tmdb/tmdb.service';

import { IMDBRow } from '../list/dto';

import { MediaItemService } from './media-item.service';

const mockMediaItemRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockTmdbService = () => ({
  findMediaByImdbId: jest.fn(),
  getTVShowDetails: jest.fn(),
  getMovieCredits: jest.fn(),
  getTVShowCredits: jest.fn(),
  getDirectors: jest.fn(),
  getTopActors: jest.fn(),
});

const mockMediaPersonService = () => ({
  saveAll: jest.fn(),
});

const makeImdbRow = (overrides: Partial<IMDBRow> = {}): IMDBRow => ({
  Const: 'tt1234567',
  Title: 'Test Movie',
  'Title Type': 'movie',
  Genres: 'Action, Drama',
  Year: '2024',
  'IMDb Rating': '7.5',
  'Runtime (mins)': '120',
  ...overrides,
});

const makeMediaItem = (overrides: Partial<MediaItem> = {}): MediaItem =>
  ({
    id: 'media-uuid',
    imdbId: 'tt1234567',
    title: 'Test Movie',
    type: MediaType.MOVIE,
    genres: ['Action', 'Drama'],
    year: 2024,
    imdbRating: 7.5,
    runtime: 120,
    ...overrides,
  }) as MediaItem;

const makeTmdbData = (type: MediaType = MediaType.MOVIE, overrides = {}) => ({
  type,
  data: {
    id: 100,
    posterPath: '/poster.jpg',
    status: 'Released',
    ...overrides,
  },
});

const makeTvShowDetails = (overrides = {}) => ({
  numberOfSeasons: 3,
  numberOfEpisodes: 30,
  ...overrides,
});

const makeCredits = () => ({
  id: 100,
  cast: [],
  crew: [],
});

describe('MediaItemService', () => {
  let service: MediaItemService;
  let mediaItemRepository: jest.Mocked<Repository<MediaItem>>;
  let tmdbService: jest.Mocked<TmdbService>;
  let mediaPersonService: jest.Mocked<MediaPersonService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaItemService,
        {
          provide: getRepositoryToken(MediaItem),
          useFactory: mockMediaItemRepository,
        },
        { provide: TmdbService, useFactory: mockTmdbService },
        { provide: MediaPersonService, useFactory: mockMediaPersonService },
      ],
    }).compile();

    service = module.get(MediaItemService);
    mediaItemRepository = module.get(getRepositoryToken(MediaItem));
    tmdbService = module.get(TmdbService);
    mediaPersonService = module.get(MediaPersonService);

    jest.spyOn(service as never, 'sleep').mockResolvedValue(undefined as never);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreate', () => {
    it('should return existing media item if found', async () => {
      const existing = makeMediaItem();
      mediaItemRepository.findOne.mockResolvedValue(existing);

      const result = await service.getOrCreate(makeImdbRow());

      expect(mediaItemRepository.findOne).toHaveBeenCalledWith({
        where: { imdbId: 'tt1234567' },
      });
      expect(mediaItemRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('should create media item with correct fields from IMDB row', async () => {
      const mediaItem = makeMediaItem();
      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(null);
      mediaItemRepository.save.mockResolvedValue(mediaItem);

      await service.getOrCreate(makeImdbRow());

      expect(mediaItemRepository.create).toHaveBeenCalledWith({
        imdbId: 'tt1234567',
        title: 'Test Movie',
        type: MediaType.MOVIE,
        genres: ['Action', 'Drama'],
        year: 2024,
        imdbRating: 7.5,
        runtime: 120,
      });
    });

    it('should handle empty Genres field', async () => {
      const mediaItem = makeMediaItem({ genres: [] });
      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(null);
      mediaItemRepository.save.mockResolvedValue(mediaItem);

      await service.getOrCreate(makeImdbRow({ Genres: '' }));

      expect(mediaItemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ genres: [] }),
      );
    });

    it('should handle missing Year, IMDb Rating, Runtime fields', async () => {
      const mediaItem = makeMediaItem({
        year: null,
        imdbRating: null,
        runtime: null,
      });
      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(null);
      mediaItemRepository.save.mockResolvedValue(mediaItem);

      await service.getOrCreate(
        makeImdbRow({ Year: '', 'IMDb Rating': '', 'Runtime (mins)': '' }),
      );

      expect(mediaItemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          year: null,
          imdbRating: null,
          runtime: null,
        }),
      );
    });

    it('should save media item directly if tmdbData is not found', async () => {
      const mediaItem = makeMediaItem();
      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(null);
      mediaItemRepository.save.mockResolvedValue(mediaItem);

      const result = await service.getOrCreate(makeImdbRow());

      expect(mediaItemRepository.save).toHaveBeenCalledWith(mediaItem);
      expect(tmdbService.getMovieCredits).not.toHaveBeenCalled();
      expect(result).toBe(mediaItem);
    });

    it('should enrich media item with tmdb data for movie and save credits', async () => {
      const mediaItem = makeMediaItem();
      const tmdbData = makeTmdbData(MediaType.MOVIE);
      const credits = makeCredits();
      const directors = [{ id: 1, name: 'Director', profilePath: null }];
      const topActors = [{ id: 2, name: 'Actor', profilePath: null }];

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(credits as never);
      tmdbService.getDirectors.mockReturnValue(directors as never);
      tmdbService.getTopActors.mockReturnValue(topActors as never);
      mediaPersonService.saveAll.mockResolvedValue(undefined);

      await service.getOrCreate(makeImdbRow());

      expect(mediaItem.tmdbId).toBe(100);
      expect(mediaItem.posterPath).toBe('/poster.jpg');
      expect(mediaItem.status).toBe('Released');
      expect(mediaItemRepository.save).toHaveBeenCalledWith(mediaItem);
      expect(tmdbService.getMovieCredits).toHaveBeenCalledWith(100);
      expect(mediaPersonService.saveAll).toHaveBeenCalledWith(
        mediaItem.id,
        directors,
        PersonRole.DIRECTOR,
      );
      expect(mediaPersonService.saveAll).toHaveBeenCalledWith(
        mediaItem.id,
        topActors,
        PersonRole.ACTOR,
      );
    });

    it('should fetch tv show details and enrich media item for TV type', async () => {
      const mediaItem = makeMediaItem({ type: MediaType.TV });
      const tmdbData = makeTmdbData(MediaType.TV);
      const tvShowDetails = makeTvShowDetails();
      const credits = makeCredits();

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.getTVShowDetails.mockResolvedValue(tvShowDetails as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getTVShowCredits.mockResolvedValue(credits as never);
      tmdbService.getDirectors.mockReturnValue([]);
      tmdbService.getTopActors.mockReturnValue([]);
      mediaPersonService.saveAll.mockResolvedValue(undefined);

      await service.getOrCreate(makeImdbRow({ 'Title Type': 'tv series' }));

      expect(tmdbService.getTVShowDetails).toHaveBeenCalledWith(100);
      expect(mediaItem.numberOfSeasons).toBe(3);
      expect(mediaItem.numberOfEpisodes).toBe(30);
      expect(tmdbService.getTVShowCredits).toHaveBeenCalledWith(100);
    });

    it('should continue if getTVShowDetails throws', async () => {
      const mediaItem = makeMediaItem({ type: MediaType.TV });
      const tmdbData = makeTmdbData(MediaType.TV);
      const credits = makeCredits();

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.getTVShowDetails.mockRejectedValue(new Error('TMDB error'));
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getTVShowCredits.mockResolvedValue(credits as never);
      tmdbService.getDirectors.mockReturnValue([]);
      tmdbService.getTopActors.mockReturnValue([]);
      mediaPersonService.saveAll.mockResolvedValue(undefined);

      await expect(
        service.getOrCreate(makeImdbRow({ 'Title Type': 'tv series' })),
      ).resolves.not.toThrow();

      expect(mediaItemRepository.save).toHaveBeenCalled();
    });

    it('should not save credits if credits are null', async () => {
      const mediaItem = makeMediaItem();
      const tmdbData = makeTmdbData(MediaType.MOVIE);

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(null);

      await service.getOrCreate(makeImdbRow());

      expect(mediaPersonService.saveAll).not.toHaveBeenCalled();
    });

    it('should call sleep after saving credits', async () => {
      const sleepSpy = jest.spyOn(service as never, 'sleep');
      const mediaItem = makeMediaItem();
      const tmdbData = makeTmdbData(MediaType.MOVIE);

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(null);

      await service.getOrCreate(makeImdbRow());

      expect(sleepSpy).toHaveBeenCalledWith(25);
    });
  });

  describe('parseMediaType', () => {
    let parseMediaType: (type?: string) => MediaType;

    beforeEach(() => {
      parseMediaType = (
        service as unknown as { parseMediaType: (type?: string) => MediaType }
      ).parseMediaType.bind(service);
    });

    it('should return TV for "tv series"', () => {
      expect(parseMediaType('tv series')).toBe(MediaType.TV);
    });

    it('should return TV for "mini series"', () => {
      expect(parseMediaType('mini series')).toBe(MediaType.TV);
    });

    it('should return MOVIE for "movie"', () => {
      expect(parseMediaType('movie')).toBe(MediaType.MOVIE);
    });

    it('should return MOVIE for undefined', () => {
      expect(parseMediaType(undefined)).toBe(MediaType.MOVIE);
    });
  });
});
