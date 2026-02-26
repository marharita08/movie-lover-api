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
  movieDetails: jest.fn(),
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
    ...overrides,
  },
});

const makeMovieDetails = (overrides = {}) => ({
  id: 100,
  status: 'Released',
  productionCountries: [{ iso31661: 'US' }, { iso31661: 'CA' }],
  productionCompanies: [{ name: 'Warner Bros.' }, { name: 'Legendary' }],
  ...overrides,
});

const makeTvShowDetails = (overrides = {}) => ({
  id: 100,
  status: 'Released',
  numberOfEpisodes: 30,
  productionCountries: [{ iso31661: 'US' }],
  productionCompanies: [{ name: 'HBO' }],
  nextEpisodeToAir: null,
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
      const movieDetails = makeMovieDetails();
      const credits = makeCredits();
      const directors = [{ id: 1, name: 'Director', profilePath: null }];
      const topActors = [{ id: 2, name: 'Actor', profilePath: null }];

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.movieDetails.mockResolvedValue(movieDetails as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(credits as never);
      tmdbService.getDirectors.mockReturnValue(directors as never);
      tmdbService.getTopActors.mockReturnValue(topActors as never);
      mediaPersonService.saveAll.mockResolvedValue(undefined);

      await service.getOrCreate(makeImdbRow());

      expect(mediaItem.type).toBe(MediaType.MOVIE);
      expect(mediaItem.tmdbId).toBe(100);
      expect(mediaItem.posterPath).toBe('/poster.jpg');
      expect(mediaItem.status).toBe('Released');
      expect(mediaItem.countries).toEqual(['US', 'CA']);
      expect(mediaItem.companies).toEqual(['Warner Bros.', 'Legendary']);
      expect(tmdbService.movieDetails).toHaveBeenCalledWith(100);
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

    it('should continue if movieDetails throws', async () => {
      const mediaItem = makeMediaItem();
      const tmdbData = makeTmdbData(MediaType.MOVIE);
      const credits = makeCredits();

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.movieDetails.mockRejectedValue(new Error('TMDB error'));
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(credits as never);
      tmdbService.getDirectors.mockReturnValue([]);
      tmdbService.getTopActors.mockReturnValue([]);
      mediaPersonService.saveAll.mockResolvedValue(undefined);

      await expect(service.getOrCreate(makeImdbRow())).resolves.not.toThrow();

      expect(mediaItemRepository.save).toHaveBeenCalled();
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
      expect(mediaItem.status).toBe('Released');
      expect(mediaItem.countries).toEqual(['US']);
      expect(mediaItem.companies).toEqual(['HBO']);
      expect(mediaItem.numberOfEpisodes).toBe(30);
      expect(mediaItem.nextEpisodeAirDate).toBeNull();
      expect(tmdbService.getTVShowCredits).toHaveBeenCalledWith(100);
    });

    it('should set nextEpisodeAirDate when nextEpisodeToAir exists', async () => {
      const mediaItem = makeMediaItem({ type: MediaType.TV });
      const tmdbData = makeTmdbData(MediaType.TV);
      const tvShowDetails = makeTvShowDetails({
        nextEpisodeToAir: { airDate: '2024-12-25' },
      });
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

      expect(mediaItem.nextEpisodeAirDate).toEqual(new Date('2024-12-25'));
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
      const movieDetails = makeMovieDetails();

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.movieDetails.mockResolvedValue(movieDetails as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(null);

      await service.getOrCreate(makeImdbRow());

      expect(mediaPersonService.saveAll).not.toHaveBeenCalled();
    });

    it('should call sleep after saving credits', async () => {
      const sleepSpy = jest.spyOn(service as never, 'sleep');
      const mediaItem = makeMediaItem();
      const tmdbData = makeTmdbData(MediaType.MOVIE);
      const movieDetails = makeMovieDetails();

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.movieDetails.mockResolvedValue(movieDetails as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(null);

      await service.getOrCreate(makeImdbRow());

      expect(sleepSpy).toHaveBeenCalledWith(25);
    });

    it('should pass 7 as limit to getTopActors', async () => {
      const mediaItem = makeMediaItem();
      const tmdbData = makeTmdbData(MediaType.MOVIE);
      const movieDetails = makeMovieDetails();
      const credits = makeCredits();

      mediaItemRepository.findOne.mockResolvedValue(null as never);
      mediaItemRepository.create.mockReturnValue(mediaItem);
      tmdbService.findMediaByImdbId.mockResolvedValue(tmdbData as never);
      tmdbService.movieDetails.mockResolvedValue(movieDetails as never);
      mediaItemRepository.save.mockResolvedValue(mediaItem);
      tmdbService.getMovieCredits.mockResolvedValue(credits as never);
      tmdbService.getDirectors.mockReturnValue([]);
      tmdbService.getTopActors.mockReturnValue([]);
      mediaPersonService.saveAll.mockResolvedValue(undefined);

      await service.getOrCreate(makeImdbRow());

      expect(tmdbService.getTopActors).toHaveBeenCalledWith(credits, 7);
    });
  });
});
