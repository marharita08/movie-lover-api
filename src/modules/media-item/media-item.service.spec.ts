import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteResult, Repository, SelectQueryBuilder } from 'typeorm';

import { MediaItem, MediaType, PersonRole } from 'src/entities';
import { MediaPersonService } from 'src/modules/media-person/media-person.service';
import { TmdbService } from 'src/modules/tmdb/tmdb.service';

import { IMDBRow } from '../list/dto';

import { MediaItemService } from './media-item.service';

const mockMediaItemRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
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

type MockQueryBuilder = {
  leftJoin: jest.Mock;
  where: jest.Mock;
  getMany: jest.Mock;
};

const mockQueryBuilder = (): MockQueryBuilder => {
  const qb: MockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
};

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
        lastSyncAt: expect.any(Date),
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

  describe('updateActiveMedia', () => {
    it('should call both updateActiveTVShows and updateActiveMovies', async () => {
      const updateActiveTVShowsSpy = jest
        .spyOn(service as any, 'updateActiveTVShows')
        .mockResolvedValue(undefined);
      const updateActiveMoviesSpy = jest
        .spyOn(service as any, 'updateActiveMovies')
        .mockResolvedValue(undefined);

      await service.updateActiveMedia();

      expect(updateActiveTVShowsSpy).toHaveBeenCalled();
      expect(updateActiveMoviesSpy).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      jest
        .spyOn(service as any, 'updateActiveTVShows')
        .mockRejectedValue(new Error('Update failed'));
      jest
        .spyOn(service as any, 'updateActiveMovies')
        .mockResolvedValue(undefined);

      await expect(service.updateActiveMedia()).resolves.not.toThrow();
    });
  });

  describe('updateActiveTVShows', () => {
    it('should update all active TV shows with current data from TMDB', async () => {
      const tvShow1 = makeMediaItem({
        id: 'tv-1',
        type: MediaType.TV,
        status: 'Returning Series',
        tmdbId: 100,
        title: 'Active Show 1',
        numberOfEpisodes: 30,
      });
      const tvShow2 = makeMediaItem({
        id: 'tv-2',
        type: MediaType.TV,
        status: 'In Production',
        tmdbId: 200,
        title: 'Active Show 2',
        numberOfEpisodes: 10,
      });

      const updatedDetails1 = makeTvShowDetails({
        status: 'Returning Series',
        numberOfEpisodes: 50,
        nextEpisodeToAir: { airDate: '2025-03-15' },
      });
      const updatedDetails2 = makeTvShowDetails({
        status: 'Ended',
        numberOfEpisodes: 100,
        nextEpisodeToAir: null,
      });

      mediaItemRepository.find
        .mockResolvedValueOnce([tvShow1, tvShow2])
        .mockResolvedValueOnce([]);

      tmdbService.getTVShowDetails
        .mockResolvedValueOnce(updatedDetails1 as never)
        .mockResolvedValueOnce(updatedDetails2 as never);

      mediaItemRepository.save.mockResolvedValue({} as MediaItem);

      await (service as any).updateActiveTVShows();

      expect(tmdbService.getTVShowDetails).toHaveBeenCalledWith(100);
      expect(tmdbService.getTVShowDetails).toHaveBeenCalledWith(200);
      expect(mediaItemRepository.save).toHaveBeenCalledTimes(2);
      expect(tvShow1.status).toBe('Returning Series');
      expect(tvShow1.numberOfEpisodes).toBe(50);
      expect(tvShow1.nextEpisodeAirDate).toEqual(new Date('2025-03-15'));
      expect(tvShow2.status).toBe('Ended');
      expect(tvShow2.numberOfEpisodes).toBe(100);
      expect(tvShow2.nextEpisodeAirDate).toBeNull();
    });

    it('should skip TV shows without tmdbId', async () => {
      const tvShow = makeMediaItem({
        id: 'tv-1',
        type: MediaType.TV,
        status: 'Returning Series',
        tmdbId: null,
        title: 'Show Without TMDB',
      });

      mediaItemRepository.find
        .mockResolvedValueOnce([tvShow])
        .mockResolvedValueOnce([]);

      await (service as any).updateActiveTVShows();

      expect(tmdbService.getTVShowDetails).not.toHaveBeenCalled();
      expect(mediaItemRepository.save).not.toHaveBeenCalled();
    });

    it('should handle errors for individual TV shows and continue processing', async () => {
      const tvShow1 = makeMediaItem({
        id: 'tv-1',
        type: MediaType.TV,
        status: 'Returning Series',
        tmdbId: 100,
        title: 'Show 1',
      });
      const tvShow2 = makeMediaItem({
        id: 'tv-2',
        type: MediaType.TV,
        status: 'Returning Series',
        tmdbId: 200,
        title: 'Show 2',
      });

      const updatedDetails = makeTvShowDetails();

      mediaItemRepository.find
        .mockResolvedValueOnce([tvShow1, tvShow2])
        .mockResolvedValueOnce([]);

      tmdbService.getTVShowDetails
        .mockRejectedValueOnce(new Error('TMDB error'))
        .mockResolvedValueOnce(updatedDetails as never);

      mediaItemRepository.save.mockResolvedValue({} as MediaItem);

      await (service as any).updateActiveTVShows();

      expect(tmdbService.getTVShowDetails).toHaveBeenCalledTimes(2);
      expect(mediaItemRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should update lastSyncAt field', async () => {
      const tvShow = makeMediaItem({
        id: 'tv-1',
        type: MediaType.TV,
        status: 'Returning Series',
        tmdbId: 100,
        title: 'Active Show',
      });

      const updatedDetails = makeTvShowDetails();

      mediaItemRepository.find
        .mockResolvedValueOnce([tvShow])
        .mockResolvedValueOnce([]);

      tmdbService.getTVShowDetails.mockResolvedValue(updatedDetails as never);
      mediaItemRepository.save.mockResolvedValue({} as MediaItem);

      await (service as any).updateActiveTVShows();

      expect(tvShow.lastSyncAt).toBeInstanceOf(Date);
    });
  });

  describe('updateActiveMovies', () => {
    it('should update all active movies with current data from TMDB', async () => {
      const movie1 = makeMediaItem({
        id: 'movie-1',
        type: MediaType.MOVIE,
        status: 'In Production',
        tmdbId: 100,
        title: 'Movie in Production',
      });
      const movie2 = makeMediaItem({
        id: 'movie-2',
        type: MediaType.MOVIE,
        status: 'Post Production',
        tmdbId: 200,
        title: 'Movie in Post',
      });

      const updatedDetails1 = makeMovieDetails({ status: 'Post Production' });
      const updatedDetails2 = makeMovieDetails({ status: 'Released' });

      mediaItemRepository.find
        .mockResolvedValueOnce([movie1, movie2])
        .mockResolvedValueOnce([]);

      tmdbService.movieDetails
        .mockResolvedValueOnce(updatedDetails1 as never)
        .mockResolvedValueOnce(updatedDetails2 as never);

      mediaItemRepository.save.mockResolvedValue({} as MediaItem);

      await (service as any).updateActiveMovies();

      expect(tmdbService.movieDetails).toHaveBeenCalledWith(100);
      expect(tmdbService.movieDetails).toHaveBeenCalledWith(200);
      expect(mediaItemRepository.save).toHaveBeenCalledTimes(2);
      expect(movie1.status).toBe('Post Production');
      expect(movie2.status).toBe('Released');
    });

    it('should skip movies without tmdbId', async () => {
      const movie = makeMediaItem({
        id: 'movie-1',
        type: MediaType.MOVIE,
        status: 'In Production',
        tmdbId: null,
        title: 'Movie Without TMDB',
      });

      mediaItemRepository.find
        .mockResolvedValueOnce([movie])
        .mockResolvedValueOnce([]);

      await (service as any).updateActiveMovies();

      expect(tmdbService.movieDetails).not.toHaveBeenCalled();
      expect(mediaItemRepository.save).not.toHaveBeenCalled();
    });

    it('should handle errors for individual movies and continue processing', async () => {
      const movie1 = makeMediaItem({
        id: 'movie-1',
        type: MediaType.MOVIE,
        status: 'In Production',
        tmdbId: 100,
        title: 'Movie 1',
      });
      const movie2 = makeMediaItem({
        id: 'movie-2',
        type: MediaType.MOVIE,
        status: 'Planned',
        tmdbId: 200,
        title: 'Movie 2',
      });

      const updatedDetails = makeMovieDetails();

      mediaItemRepository.find
        .mockResolvedValueOnce([movie1, movie2])
        .mockResolvedValueOnce([]);

      tmdbService.movieDetails
        .mockRejectedValueOnce(new Error('TMDB error'))
        .mockResolvedValueOnce(updatedDetails as never);

      mediaItemRepository.save.mockResolvedValue({} as MediaItem);

      await (service as any).updateActiveMovies();

      expect(tmdbService.movieDetails).toHaveBeenCalledTimes(2);
      expect(mediaItemRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should update lastSyncAt field', async () => {
      const movie = makeMediaItem({
        id: 'movie-1',
        type: MediaType.MOVIE,
        status: 'In Production',
        tmdbId: 100,
        title: 'Active Movie',
      });

      const updatedDetails = makeMovieDetails();

      mediaItemRepository.find
        .mockResolvedValueOnce([movie])
        .mockResolvedValueOnce([]);

      tmdbService.movieDetails.mockResolvedValue(updatedDetails as never);
      mediaItemRepository.save.mockResolvedValue({} as MediaItem);

      await (service as any).updateActiveMovies();

      expect(movie.lastSyncAt).toBeInstanceOf(Date);
    });
  });

  describe('cleanupOrphanedMediaItems', () => {
    it('should find and delete orphaned media items', async () => {
      const orphan1 = makeMediaItem({
        id: 'orphan-1',
        title: 'Orphaned Movie 1',
      });
      const orphan2 = makeMediaItem({
        id: 'orphan-2',
        title: 'Orphaned Movie 2',
      });

      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([orphan1, orphan2]);
      mediaItemRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<MediaItem>,
      );
      const deleteResult: DeleteResult = { affected: 2, raw: [] };
      mediaItemRepository.delete.mockResolvedValue(deleteResult);

      await service.cleanupOrphanedMediaItems();

      expect(mediaItemRepository.createQueryBuilder).toHaveBeenCalledWith(
        'mediaItem',
      );
      expect(qb.leftJoin).toHaveBeenCalledWith(
        'mediaItem.listMediaItems',
        'listMediaItem',
      );
      expect(qb.where).toHaveBeenCalledWith('listMediaItem.id IS NULL');
      expect(qb.getMany).toHaveBeenCalled();
      expect(mediaItemRepository.delete).toHaveBeenCalledWith([
        'orphan-1',
        'orphan-2',
      ]);
    });

    it('should not delete anything when no orphaned items found', async () => {
      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      mediaItemRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<MediaItem>,
      );

      await service.cleanupOrphanedMediaItems();

      expect(qb.getMany).toHaveBeenCalled();
      expect(mediaItemRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const qb = mockQueryBuilder();
      qb.getMany.mockRejectedValue(new Error('Database error'));
      mediaItemRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<MediaItem>,
      );

      await expect(service.cleanupOrphanedMediaItems()).resolves.not.toThrow();

      expect(mediaItemRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const orphan = makeMediaItem({
        id: 'orphan-1',
        title: 'Orphaned Movie',
      });

      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([orphan]);
      mediaItemRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<MediaItem>,
      );
      mediaItemRepository.delete.mockRejectedValue(
        new Error('Deletion failed'),
      );

      await expect(service.cleanupOrphanedMediaItems()).resolves.not.toThrow();
    });

    it('should log the number of orphaned items found', async () => {
      const orphan1 = makeMediaItem({ id: 'orphan-1' });
      const orphan2 = makeMediaItem({ id: 'orphan-2' });
      const orphan3 = makeMediaItem({ id: 'orphan-3' });

      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([orphan1, orphan2, orphan3]);
      mediaItemRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<MediaItem>,
      );
      const deleteResult: DeleteResult = { affected: 3, raw: [] };
      mediaItemRepository.delete.mockResolvedValue(deleteResult);

      await service.cleanupOrphanedMediaItems();

      expect(mediaItemRepository.delete).toHaveBeenCalledWith([
        'orphan-1',
        'orphan-2',
        'orphan-3',
      ]);
    });
  });
});
