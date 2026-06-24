import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike } from 'typeorm';

import {
  List,
  ListMediaItem,
  ListStatus,
  MediaPerson,
  MediaType,
} from 'src/entities';
import { CsvParserService } from 'src/modules/csv-parser/csv-parser.service';
import { FileService } from 'src/modules/file/file.service';
import { ListMediaItemService } from 'src/modules/list-media-item/list-media-item.service';
import { TranslationService } from 'src/modules/translation/translation.service';

import { ListService } from './list.service';

const mockListRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: { createQueryBuilder: jest.fn() },
});

const mockListMediaItemsRepository = () => ({
  createQueryBuilder: jest.fn(),
  manager: { createQueryBuilder: jest.fn() },
});

const mockMediaPersonsRepository = () => ({
  createQueryBuilder: jest.fn(),
  manager: { createQueryBuilder: jest.fn() },
});

const mockFileService = () => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  download: jest.fn(),
});

const mockCsvParserService = () => ({
  parseAndValidate: jest.fn(),
});

const mockListMediaItemService = () => ({
  add: jest.fn(),
});

const makeList = (overrides: Partial<List> = {}): List =>
  ({
    id: 'list-uuid',
    name: 'Test List',
    userId: 'user-uuid',
    fileId: 'file-uuid',
    status: ListStatus.COMPLETED,
    totalItems: 10,
    errorMessage: null,
    createdAt: new Date(),
    ...overrides,
  }) as List;

const makeFile = (overrides = {}) => ({
  id: 'file-uuid',
  userId: 'user-uuid',
  ...overrides,
});

const makeUser = (overrides = {}) => ({
  id: 'user-uuid',
  language: 'en-US',
  ...overrides,
});

const makeQueryBuilder = (rawResult: unknown = [], extraMethods = {}) => ({
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rawResult),
  getRawOne: jest.fn().mockResolvedValue(rawResult),
  getCount: jest.fn().mockResolvedValue(0),
  setParameter: jest.fn().mockReturnThis(),
  setParameters: jest.fn().mockReturnThis(),
  getQuery: jest.fn().mockReturnValue('mock-query'),
  getParameters: jest.fn().mockReturnValue({}),
  from: jest.fn().mockReturnThis(),
  ...extraMethods,
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('ListService', () => {
  let service: ListService;
  let listRepository: ReturnType<typeof mockListRepository>;
  let listMediaItemsRepository: ReturnType<typeof mockListMediaItemsRepository>;
  let mediaPersonsRepository: ReturnType<typeof mockMediaPersonsRepository>;
  let fileService: ReturnType<typeof mockFileService>;
  let csvParserService: ReturnType<typeof mockCsvParserService>;
  let listMediaItemService: ReturnType<typeof mockListMediaItemService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListService,
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
        { provide: getRepositoryToken(List), useFactory: mockListRepository },
        {
          provide: getRepositoryToken(ListMediaItem),
          useFactory: mockListMediaItemsRepository,
        },
        {
          provide: getRepositoryToken(MediaPerson),
          useFactory: mockMediaPersonsRepository,
        },
        { provide: FileService, useFactory: mockFileService },
        { provide: CsvParserService, useFactory: mockCsvParserService },
        { provide: ListMediaItemService, useFactory: mockListMediaItemService },
      ],
    }).compile();

    service = module.get(ListService);
    listRepository = module.get(getRepositoryToken(List));
    listMediaItemsRepository = module.get(getRepositoryToken(ListMediaItem));
    mediaPersonsRepository = module.get(getRepositoryToken(MediaPerson));
    fileService = module.get(FileService);
    csvParserService = module.get(CsvParserService);
    listMediaItemService = module.get(ListMediaItemService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should throw ForbiddenException if file not found', async () => {
      fileService.findOne.mockResolvedValue(null as never);

      await expect(
        service.create(
          { name: 'List', fileId: 'file-uuid' },
          makeUser() as never,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(listRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if file belongs to another user', async () => {
      fileService.findOne.mockResolvedValue(
        makeFile({ userId: 'other-user' }) as never,
      );

      await expect(
        service.create(
          { name: 'List', fileId: 'file-uuid' },
          makeUser() as never,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create list and return it immediately without waiting for processing', async () => {
      const list = makeList({ status: ListStatus.PROCESSING });
      fileService.findOne.mockResolvedValue(makeFile() as never);
      listRepository.create.mockReturnValue(list);
      listRepository.save.mockResolvedValue(list);
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue([]);

      const result = await service.create(
        { name: 'List', fileId: 'file-uuid' },
        makeUser() as never,
      );

      expect(listRepository.create).toHaveBeenCalledWith({
        name: 'List',
        fileId: 'file-uuid',
        userId: 'user-uuid',
      });
      expect(result).toBe(list);
      expect(result.status).toBe(ListStatus.PROCESSING);
    });
  });

  describe('processList', () => {
    const setupCreate = () => {
      const list = makeList({ status: ListStatus.PROCESSING });
      fileService.findOne.mockResolvedValue(makeFile() as never);
      listRepository.create.mockReturnValue(list);
      listRepository.save.mockResolvedValue(list);
      return list;
    };

    it('should download csv, parse rows, save totalItems and call add for each non-episode row', async () => {
      const list = setupCreate();
      const rows = [
        { Const: 'tt1', Title: 'Title 1', 'Title Type': 'Movie' },
        { Const: 'tt2', Title: 'Title 2', 'Title Type': 'tvEpisode' },
        { Const: 'tt3', Title: 'Title 3', 'Title Type': 'TV Series' },
      ];
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue(rows as never);
      listMediaItemService.add.mockResolvedValue(undefined);

      await service.create(
        { name: 'List', fileId: 'file-uuid' },
        makeUser() as never,
      );
      await flushPromises();

      expect(fileService.download).toHaveBeenCalledWith(list.fileId);
      expect(csvParserService.parseAndValidate).toHaveBeenCalledWith(
        'csv content',
        expect.any(Function),
      );
      expect(list.totalItems).toBe(3);
      // tvEpisode filtered out, positions are indices within the filtered batch
      expect(listMediaItemService.add).toHaveBeenCalledTimes(2);
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[0],
        0,
      );
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[2],
        1,
      );
    });

    it('should set list status to COMPLETED after processing', async () => {
      setupCreate();
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue([]);

      await service.create(
        { name: 'List', fileId: 'file-uuid' },
        makeUser() as never,
      );
      await flushPromises();

      const lastSaveCall = listRepository.save.mock.calls.at(-1)?.[0] as List;
      expect(lastSaveCall.status).toBe(ListStatus.COMPLETED);
    });

    it('should set status to FAILED if processing throws', async () => {
      const list = setupCreate();
      fileService.download.mockRejectedValue(new Error('Download failed'));
      listRepository.update.mockResolvedValue(undefined as never);

      await service.create(
        { name: 'List', fileId: 'file-uuid' },
        makeUser() as never,
      );
      await flushPromises();

      expect(listRepository.update).toHaveBeenCalledWith(list.id, {
        status: ListStatus.FAILED,
        errorMessage: 'Download failed',
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated lists', async () => {
      const lists = [makeList(), makeList({ id: 'list-uuid-2' })];
      listRepository.findAndCount.mockResolvedValue([lists, 2]);

      const result = await service.findAll({ page: 1, limit: 10 }, 'user-uuid');

      expect(listRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['file'],
        where: { userId: 'user-uuid' },
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual({
        results: lists,
        totalPages: 1,
        page: 1,
        totalResults: 2,
      });
    });

    it('should filter by name using ILike and calculate totalPages correctly', async () => {
      listRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll(
        { name: 'test', page: 1, limit: 10 },
        'user-uuid',
      );

      expect(listRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', name: ILike('%test%') },
        }),
      );
      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return list if found', async () => {
      const list = makeList();
      listRepository.findOne.mockResolvedValue(list);

      const result = await service.findOne('list-uuid', 'user-uuid');

      expect(listRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'list-uuid', userId: 'user-uuid' },
      });
      expect(result).toBe(list);
    });

    it('should throw NotFoundException if list not found', async () => {
      listRepository.findOne.mockResolvedValue(null as never);

      await expect(service.findOne('list-uuid', 'user-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete file and remove list', async () => {
      const list = makeList();
      listRepository.findOne.mockResolvedValue(list);
      fileService.delete.mockResolvedValue(undefined);
      listRepository.delete.mockResolvedValue(list);

      await service.delete('list-uuid', 'user-uuid');

      expect(fileService.delete).toHaveBeenCalledWith(list.fileId);
      expect(listRepository.delete).toHaveBeenCalledWith(list.id);
    });
  });

  describe('checkListStatus', () => {
    it.each([
      ['still processing', ListStatus.PROCESSING],
      ['processing failed', ListStatus.FAILED],
    ])(
      'should throw BadRequestException when list is %s',
      async (_label, status) => {
        listRepository.findOne.mockResolvedValue(makeList({ status }));

        await expect(
          service.getGenreAnalytics('list-uuid', 'user-uuid'),
        ).rejects.toThrow(BadRequestException);
      },
    );
  });

  describe('getGenreAnalytics', () => {
    it('should return genre stats as record', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([
        { genre: 'Action', count: '5' },
        { genre: 'Drama', count: '3' },
      ]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getGenreAnalytics('list-uuid', 'user-uuid');

      expect(result).toEqual({ Action: 5, Drama: 3 });
    });
  });

  describe('getPersonsAnalytics', () => {
    it('should return paginated persons analytics', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const subQb = makeQueryBuilder();
      const outerQb = makeQueryBuilder([
        {
          id: 'p-uuid',
          name: 'Actor',
          profilePath: '/profile.jpg',
          itemCount: '5',
          titles: ['Movie 1', 'Movie 2'],
          totalCount: '20',
        },
      ]);

      mediaPersonsRepository.createQueryBuilder.mockReturnValue(subQb as never);
      mediaPersonsRepository.manager.createQueryBuilder.mockReturnValue(
        outerQb as never,
      );

      const result = await service.getPersonsAnalytics(
        'list-uuid',
        'user-uuid',
        {
          role: 'ACTOR' as never,
          page: 1,
          limit: 10,
        },
      );

      expect(result.totalResults).toBe(20);
      expect(result.totalPages).toBe(2);
      expect(result.results[0]).toEqual({
        id: 'p-uuid',
        name: 'Actor',
        profilePath: '/profile.jpg',
        itemCount: 5,
        titles: 'Movie 1, Movie 2',
      });
    });

    it('should filter persons by search query', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const subQb = makeQueryBuilder();
      const searchSubQb = makeQueryBuilder();
      const outerQb = makeQueryBuilder([
        {
          id: 'p-uuid',
          name: 'Tom Hanks',
          profilePath: '/profile.jpg',
          itemCount: '3',
          titles: ['Forrest Gump'],
          totalCount: '1',
        },
      ]);

      mediaPersonsRepository.createQueryBuilder
        .mockReturnValueOnce(subQb as never)
        .mockReturnValueOnce(searchSubQb as never);
      mediaPersonsRepository.manager.createQueryBuilder.mockReturnValue(
        outerQb as never,
      );

      const result = await service.getPersonsAnalytics(
        'list-uuid',
        'user-uuid',
        {
          role: 'ACTOR' as never,
          page: 1,
          limit: 10,
          search: 'Tom',
        },
      );

      expect(result.results[0].name).toBe('Tom Hanks');
      expect(subQb.setParameter).toHaveBeenCalledWith('search', '%Tom%');
    });
  });

  describe('getMediaItems', () => {
    it('should return paginated media items without internal fields', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const subQb = makeQueryBuilder();
      const outerQb = makeQueryBuilder([
        {
          id: 1,
          title: 'Movie',
          posterPath: '/poster.jpg',
          type: MediaType.MOVIE,
          imdbId: 'tt1234567',
          position: 1,
          totalCount: '5',
        },
      ]);

      listMediaItemsRepository.createQueryBuilder.mockReturnValue(
        subQb as never,
      );
      listMediaItemsRepository.manager.createQueryBuilder.mockReturnValue(
        outerQb as never,
      );

      const result = await service.getMediaItems('list-uuid', 'user-uuid', {
        page: 1,
        limit: 10,
      });

      expect(result.totalResults).toBe(5);
      expect(result.results[0].title).toBe('Movie');
      expect(result.results[0]).not.toHaveProperty('position');
      expect(result.results[0]).not.toHaveProperty('totalCount');
    });

    it('should filter by search query', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const subQb = makeQueryBuilder();
      const outerQb = makeQueryBuilder([
        {
          id: 1,
          title: 'Inception',
          posterPath: '/poster.jpg',
          type: MediaType.MOVIE,
          imdbId: 'tt1375666',
          position: 1,
          totalCount: '1',
        },
      ]);

      listMediaItemsRepository.createQueryBuilder.mockReturnValue(
        subQb as never,
      );
      listMediaItemsRepository.manager.createQueryBuilder.mockReturnValue(
        outerQb as never,
      );

      await service.getMediaItems('list-uuid', 'user-uuid', {
        page: 1,
        limit: 10,
        search: 'Inception',
      });

      expect(subQb.andWhere).toHaveBeenCalledWith(
        'LOWER(media.title) LIKE LOWER(:search)',
        { search: '%Inception%' },
      );
    });
  });

  describe('getMediaTypeStats', () => {
    it('should return media type stats as record', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([
        { type: MediaType.MOVIE, count: '8' },
        { type: MediaType.TV, count: '2' },
      ]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getMediaTypeStats('list-uuid', 'user-uuid');

      expect(result).toEqual({ [MediaType.MOVIE]: 8, [MediaType.TV]: 2 });
    });
  });

  describe('getRatingStats', () => {
    it('should return all 10 rating slots with zeros for missing ratings', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([
        { rating: '8', count: '3' },
        { rating: '10', count: '1' },
      ]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getRatingStats('list-uuid', 'user-uuid', {});

      expect(Object.keys(result)).toHaveLength(10);
      expect(result[8]).toBe(3);
      expect(result[10]).toBe(1);
      expect(result[1]).toBe(0);
    });
  });

  describe('getGenres', () => {
    it('should return list of genres', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([{ genre: 'Action' }, { genre: 'Drama' }]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      expect(await service.getGenres('list-uuid', 'user-uuid')).toEqual([
        'Action',
        'Drama',
      ]);
    });
  });

  describe('getYears', () => {
    it('should return list of years', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([{ year: 2022 }, { year: 2023 }]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      expect(await service.getYears('list-uuid', 'user-uuid')).toEqual([
        2022, 2023,
      ]);
    });
  });

  describe('getYearsAnalytics', () => {
    it('should return year stats as record', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([
        { year: '2022', count: '4' },
        { year: '2023', count: '6' },
      ]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      expect(await service.getYearsAnalytics('list-uuid', 'user-uuid')).toEqual(
        { '2022': 4, '2023': 6 },
      );
    });
  });

  describe('getAmountStats', () => {
    it('should return total count and runtimes', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(10);

      const moviesRuntimeQb = makeQueryBuilder();
      moviesRuntimeQb.getRawOne.mockResolvedValue({ totalRuntime: '1200' });

      const tvRuntimeQb = makeQueryBuilder();
      tvRuntimeQb.getRawOne.mockResolvedValue({ totalRuntime: '800' });

      listMediaItemsRepository.createQueryBuilder
        .mockReturnValueOnce(countQb as never)
        .mockReturnValueOnce(moviesRuntimeQb as never)
        .mockReturnValueOnce(tvRuntimeQb as never);

      const result = await service.getAmountStats('list-uuid', 'user-uuid');

      expect(result).toEqual({
        total: 10,
        totalMoviesRuntime: '1200',
        totalTVShowsRuntime: '800',
        totalRuntime: 2000,
      });
    });
  });

  describe('getUpcomingTVShows', () => {
    it('should return paginated upcoming TV shows', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const resultsQb = makeQueryBuilder([
        { id: 1, title: 'TV Show', posterPath: '/poster.jpg' },
      ]);
      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(5);

      listMediaItemsRepository.createQueryBuilder
        .mockReturnValueOnce(resultsQb as never)
        .mockReturnValueOnce(countQb as never);

      const result = await service.getUpcomingTVShows(
        'list-uuid',
        'user-uuid',
        { page: 1, limit: 10 },
      );

      expect(result.totalResults).toBe(5);
      expect(result.results[0].title).toBe('TV Show');
    });
  });

  describe('getCountryAnalytics', () => {
    it('should return country stats as record', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([
        { country: 'US', count: '15' },
        { country: 'GB', count: '8' },
      ]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      expect(
        await service.getCountryAnalytics('list-uuid', 'user-uuid'),
      ).toEqual({ US: 15, GB: 8 });
    });
  });

  describe('getCompanyAnalytics', () => {
    it('should return company stats as record limited to 40', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([{ company: 'Warner Bros.', count: '12' }]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getCompanyAnalytics(
        'list-uuid',
        'user-uuid',
      );

      expect(result).toEqual({ 'Warner Bros.': 12 });
      expect(qb.limit).toHaveBeenCalledWith(40);
    });
  });

  describe('deleteFailedLists', () => {
    it('should delete failed lists in batches and stop when batch is partial', async () => {
      const batch1 = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `List ${i + 1}`,
        fileId: `file-${i + 1}`,
        status: ListStatus.FAILED,
      }));
      const batch2 = Array.from({ length: 15 }, (_, i) => ({
        id: i + 21,
        name: `List ${i + 21}`,
        fileId: `file-${i + 21}`,
        status: ListStatus.FAILED,
      }));

      listRepository.find
        .mockResolvedValueOnce(batch1 as any)
        .mockResolvedValueOnce(batch2 as any);
      fileService.delete.mockResolvedValue(undefined);
      listRepository.delete.mockResolvedValue({} as any);

      await service.deleteFailedLists();

      expect(listRepository.find).toHaveBeenCalledTimes(2);
      expect(listRepository.find).toHaveBeenNthCalledWith(1, {
        where: { status: ListStatus.FAILED },
        take: 20,
        skip: 0,
      });
      expect(listRepository.find).toHaveBeenNthCalledWith(2, {
        where: { status: ListStatus.FAILED },
        take: 20,
        skip: 20,
      });
      expect(fileService.delete).toHaveBeenCalledTimes(35);
      expect(listRepository.delete).toHaveBeenCalledTimes(35);
    });

    it('should do nothing if there are no failed lists', async () => {
      listRepository.find.mockResolvedValueOnce([]);

      await service.deleteFailedLists();

      expect(listRepository.find).toHaveBeenCalledTimes(1);
      expect(fileService.delete).not.toHaveBeenCalled();
    });

    it('should continue processing remaining lists if some deletions fail', async () => {
      const failedLists = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `List ${i + 1}`,
        fileId: `file-${i + 1}`,
        status: ListStatus.FAILED,
      }));

      listRepository.find.mockResolvedValueOnce(failedLists as any);
      fileService.delete.mockImplementation((fileId: string) =>
        fileId === 'file-2'
          ? Promise.reject(new Error('fail'))
          : Promise.resolve(undefined),
      );
      listRepository.delete.mockResolvedValue({} as any);

      await service.deleteFailedLists();

      expect(fileService.delete).toHaveBeenCalledTimes(5);
      expect(listRepository.delete).toHaveBeenCalledTimes(4);
    });
  });
});
