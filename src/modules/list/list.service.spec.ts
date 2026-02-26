import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

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

import { ListService } from './list.service';

const mockListRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockListMediaItemsRepository = () => ({
  createQueryBuilder: jest.fn(),
});

const mockMediaPersonsRepository = () => ({
  createQueryBuilder: jest.fn(),
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
  ...extraMethods,
});

describe('ListService', () => {
  let service: ListService;
  let listRepository: jest.Mocked<Repository<List>>;
  let listMediaItemsRepository: jest.Mocked<Repository<ListMediaItem>>;
  let mediaPersonsRepository: jest.Mocked<Repository<MediaPerson>>;
  let fileService: jest.Mocked<FileService>;
  let csvParserService: jest.Mocked<CsvParserService>;
  let listMediaItemService: jest.Mocked<ListMediaItemService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListService,
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
        service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid'),
      ).rejects.toThrow(ForbiddenException);

      expect(listRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if file belongs to another user', async () => {
      fileService.findOne.mockResolvedValue(
        makeFile({ userId: 'other-user' }) as never,
      );

      await expect(
        service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create list, save and start processing', async () => {
      const list = makeList({ status: ListStatus.PROCESSING });
      fileService.findOne.mockResolvedValue(makeFile() as never);
      listRepository.create.mockReturnValue(list);
      listRepository.save.mockResolvedValue(list);
      listRepository.findOne.mockResolvedValue(list);
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue([]);

      const result = await service.create(
        { name: 'List', fileId: 'file-uuid' },
        'user-uuid',
      );

      expect(listRepository.create).toHaveBeenCalledWith({
        name: 'List',
        fileId: 'file-uuid',
        userId: 'user-uuid',
      });
      expect(listRepository.save).toHaveBeenCalled();
      expect(result).toBe(list);
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

    it('should download csv, parse and validate rows, and set totalItems', async () => {
      const list = setupCreate();
      const rows = [
        { Const: 'tt1', Title: 'Title 1', Genres: 'Genre1, Genre2' },
        { Const: 'tt2', Title: 'Title 2', Genres: 'Genre3, Genre4' },
      ];
      listRepository.findOne.mockResolvedValue(list);
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue(rows as never);
      listMediaItemService.add.mockResolvedValue(undefined);

      await service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid');

      expect(fileService.download).toHaveBeenCalledWith(list.fileId);
      expect(csvParserService.parseAndValidate).toHaveBeenCalledWith(
        'csv content',
        expect.any(Function),
      );
      expect(list.totalItems).toBe(2);
    });

    it('should call listMediaItemService.add for each row with correct position', async () => {
      const list = setupCreate();
      const rows = [
        { Const: 'tt1', Title: 'Title 1', Genres: 'Genre1, Genre2' },
        { Const: 'tt2', Title: 'Title 2', Genres: 'Genre3, Genre4' },
        { Const: 'tt3', Title: 'Title 3', Genres: 'Genre5, Genre6' },
      ];
      listRepository.findOne.mockResolvedValue(list);
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue(rows as never);
      listMediaItemService.add.mockResolvedValue(undefined);

      await service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid');

      expect(listMediaItemService.add).toHaveBeenCalledTimes(3);
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[0],
        0,
      );
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[1],
        1,
      );
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[2],
        2,
      );
    });

    it('should process rows in batches of 10', async () => {
      const list = setupCreate();
      const rows = Array.from({ length: 25 }, (_, i) => ({
        Const: `tt${i}`,
        Title: `Title ${i}`,
        Genres: `Genre${i}`,
      }));
      listRepository.findOne.mockResolvedValue(list);
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue(rows as never);
      listMediaItemService.add.mockResolvedValue(undefined);

      await service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid');

      expect(listMediaItemService.add).toHaveBeenCalledTimes(25);
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[0],
        0,
      );
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[9],
        9,
      );
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[10],
        10,
      );
      expect(listMediaItemService.add).toHaveBeenCalledWith(
        list.id,
        rows[24],
        24,
      );
    });

    it('should set list status to COMPLETED after processing', async () => {
      const list = setupCreate();
      listRepository.findOne.mockResolvedValue(list);
      fileService.download.mockResolvedValue('csv content');
      csvParserService.parseAndValidate.mockResolvedValue([]);
      listRepository.save.mockResolvedValue(list);

      await service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid');

      const lastSaveCall = listRepository.save.mock.calls.at(-1)?.[0] as List;
      expect(lastSaveCall.status).toBe(ListStatus.COMPLETED);
    });

    it('should set status to FAILED if processing throws', async () => {
      const list = setupCreate();
      listRepository.findOne.mockResolvedValue(list);
      fileService.download.mockRejectedValue(new Error('Download failed'));
      listRepository.update.mockResolvedValue(undefined as never);

      await service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid');

      expect(listRepository.update).toHaveBeenCalledWith(list.id, {
        status: ListStatus.FAILED,
        errorMessage: 'Download failed',
      });
    });

    it('should return early if list not found during processing', async () => {
      setupCreate();
      listRepository.findOne.mockResolvedValueOnce(null as never);

      await service.create({ name: 'List', fileId: 'file-uuid' }, 'user-uuid');

      expect(fileService.download).not.toHaveBeenCalled();
      expect(csvParserService.parseAndValidate).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated lists', async () => {
      const lists = [makeList(), makeList({ id: 'list-uuid-2' })];
      listRepository.findAndCount.mockResolvedValue([lists, 2]);

      const result = await service.findAll({ page: 1, limit: 10 }, 'user-uuid');

      expect(listRepository.findAndCount).toHaveBeenCalledWith({
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

    it('should filter by name using ILike', async () => {
      listRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ name: 'test', page: 1, limit: 10 }, 'user-uuid');

      expect(listRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', name: ILike('%test%') },
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      listRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll({ page: 1, limit: 10 }, 'user-uuid');

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

  describe('update', () => {
    it('should update and return list', async () => {
      const list = makeList();
      listRepository.findOne.mockResolvedValue(list);
      listRepository.save.mockResolvedValue({
        ...list,
        name: 'Updated',
      } as List);

      const result = await service.update(
        'list-uuid',
        { name: 'Updated' },
        'user-uuid',
      );

      expect(listRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException if new file belongs to another user', async () => {
      const list = makeList();
      listRepository.findOne.mockResolvedValue(list);
      fileService.findOne.mockResolvedValue(
        makeFile({ userId: 'other-user' }) as never,
      );

      await expect(
        service.update('list-uuid', { fileId: 'new-file-uuid' }, 'user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not check file if fileId is the same', async () => {
      const list = makeList();
      listRepository.findOne.mockResolvedValue(list);
      listRepository.save.mockResolvedValue(list);

      await service.update('list-uuid', { fileId: 'file-uuid' }, 'user-uuid');

      expect(fileService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete file and remove list', async () => {
      const list = makeList();
      listRepository.findOne.mockResolvedValue(list);
      fileService.delete.mockResolvedValue(undefined);
      listRepository.remove.mockResolvedValue(list);

      await service.delete('list-uuid', 'user-uuid');

      expect(fileService.delete).toHaveBeenCalledWith(list.fileId);
      expect(listRepository.remove).toHaveBeenCalledWith(list);
    });
  });

  describe('getGenreAnalytics', () => {
    it('should throw BadRequestException if list is still processing', async () => {
      listRepository.findOne.mockResolvedValue(
        makeList({ status: ListStatus.PROCESSING }),
      );

      await expect(
        service.getGenreAnalytics('list-uuid', 'user-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if list processing failed', async () => {
      listRepository.findOne.mockResolvedValue(
        makeList({ status: ListStatus.FAILED, errorMessage: 'Some error' }),
      );

      await expect(
        service.getGenreAnalytics('list-uuid', 'user-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

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
    it('should throw BadRequestException if list is not completed', async () => {
      listRepository.findOne.mockResolvedValue(
        makeList({ status: ListStatus.PROCESSING }),
      );

      await expect(
        service.getPersonsAnalytics('list-uuid', 'user-uuid', {
          role: 'ACTOR' as never,
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return paginated persons analytics', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const countQb = makeQueryBuilder();
      countQb.getRawOne.mockResolvedValue({ count: '20' });

      const resultsQb = makeQueryBuilder([
        {
          id: 'p-uuid',
          name: 'Actor',
          profilePath: '/profile.jpg',
          itemCount: '5',
          titles: ['Movie 1', 'Movie 2'],
        },
      ]);

      mediaPersonsRepository.createQueryBuilder
        .mockReturnValueOnce(countQb as never)
        .mockReturnValueOnce(resultsQb as never);

      const result = await service.getPersonsAnalytics(
        'list-uuid',
        'user-uuid',
        { role: 'ACTOR' as never, page: 1, limit: 10 },
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
  });

  describe('getMediaItems', () => {
    it('should throw BadRequestException if list is not completed', async () => {
      listRepository.findOne.mockResolvedValue(
        makeList({ status: ListStatus.PROCESSING }),
      );

      await expect(
        service.getMediaItems('list-uuid', 'user-uuid', { page: 1, limit: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return paginated media items', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const countQb = makeQueryBuilder();
      countQb.getRawOne.mockResolvedValue({ count: '5' });

      const resultsQb = makeQueryBuilder([
        {
          id: 1,
          title: 'Movie',
          posterPath: '/poster.jpg',
          type: MediaType.MOVIE,
          imdbId: 'tt1234567',
        },
      ]);

      listMediaItemsRepository.createQueryBuilder
        .mockReturnValueOnce(countQb as never)
        .mockReturnValueOnce(resultsQb as never);

      const result = await service.getMediaItems('list-uuid', 'user-uuid', {
        page: 1,
        limit: 10,
      });

      expect(result.totalResults).toBe(5);
      expect(result.results[0].title).toBe('Movie');
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
    it('should return rating stats with zeros for missing ratings', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([
        { rating: '8', count: '3' },
        { rating: '10', count: '1' },
      ]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getRatingStats('list-uuid', 'user-uuid', {});

      expect(result[8]).toBe(3);
      expect(result[10]).toBe(1);
      expect(result[1]).toBe(0);
      expect(result[5]).toBe(0);
    });

    it('should return all 10 rating slots', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getRatingStats('list-uuid', 'user-uuid', {});

      expect(Object.keys(result)).toHaveLength(10);
    });
  });

  describe('getGenres', () => {
    it('should return list of genres', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([{ genre: 'Action' }, { genre: 'Drama' }]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getGenres('list-uuid', 'user-uuid');

      expect(result).toEqual(['Action', 'Drama']);
    });
  });

  describe('getYears', () => {
    it('should return list of years', async () => {
      listRepository.findOne.mockResolvedValue(makeList());
      const qb = makeQueryBuilder([{ year: 2022 }, { year: 2023 }]);
      listMediaItemsRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getYears('list-uuid', 'user-uuid');

      expect(result).toEqual([2022, 2023]);
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

      const result = await service.getYearsAnalytics('list-uuid', 'user-uuid');

      expect(result).toEqual({ '2022': 4, '2023': 6 });
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
    it('should return upcoming TV shows within next year', async () => {
      listRepository.findOne.mockResolvedValue(makeList());

      const resultsQb = makeQueryBuilder([
        {
          id: 1,
          title: 'TV Show',
          posterPath: '/poster.jpg',
        },
      ]);

      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(5);

      listMediaItemsRepository.createQueryBuilder
        .mockReturnValueOnce(resultsQb as never)
        .mockReturnValueOnce(countQb as never);

      const result = await service.getUpcomingTVShows(
        'list-uuid',
        'user-uuid',
        {
          page: 1,
          limit: 10,
        },
      );

      expect(result.totalResults).toBe(5);
      expect(result.results[0].title).toBe('TV Show');
    });
  });
});
