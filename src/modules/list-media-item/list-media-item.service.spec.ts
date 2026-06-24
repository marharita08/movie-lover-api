import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ListMediaItem } from 'src/entities';
import { MediaItemService } from 'src/modules/media-item/media-item.service';

import { IMDBRow } from '../list/dto';

import { ListMediaItemService } from './list-media-item.service';

const mockListMediaItemRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockMediaItemService = () => ({
  getOrCreate: jest.fn(),
});

const makeImdbRow = (overrides: Partial<IMDBRow> = {}): IMDBRow => ({
  Const: 'tt1234567',
  Title: 'Test Movie',
  'Title Type': 'movie',
  Genres: 'Action',
  Year: '2024',
  'IMDb Rating': '7.5',
  'Runtime (mins)': '120',
  'Your Rating': '8',
  'Date Rated': '2024-01-15',
  ...overrides,
});

const makeMediaItem = (overrides = {}) => ({
  id: 'media-uuid',
  imdbId: 'tt1234567',
  title: 'Test Movie',
  ...overrides,
});

const makeListMediaItem = (
  overrides: Partial<ListMediaItem> = {},
): ListMediaItem =>
  ({
    id: 'list-media-item-uuid',
    listId: 'list-uuid',
    mediaItemId: 'media-uuid',
    userRating: 8,
    dateRated: new Date('2024-01-15'),
    position: 1,
    ...overrides,
  }) as ListMediaItem;

describe('ListMediaItemService', () => {
  let service: ListMediaItemService;
  let listMediaItemRepository: jest.Mocked<Repository<ListMediaItem>>;
  let mediaItemService: jest.Mocked<MediaItemService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMediaItemService,
        {
          provide: getRepositoryToken(ListMediaItem),
          useFactory: mockListMediaItemRepository,
        },
        { provide: MediaItemService, useFactory: mockMediaItemService },
      ],
    }).compile();

    service = module.get(ListMediaItemService);
    listMediaItemRepository = module.get(getRepositoryToken(ListMediaItem));
    mediaItemService = module.get(MediaItemService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('add', () => {
    it('should create and save list media item with rating, date and position', async () => {
      const row = makeImdbRow();
      const mediaItem = makeMediaItem();
      const listMediaItem = makeListMediaItem();

      mediaItemService.getOrCreate.mockResolvedValue(mediaItem as never);
      listMediaItemRepository.create.mockReturnValue(listMediaItem);
      listMediaItemRepository.save.mockResolvedValue(listMediaItem);

      await service.add('list-uuid', row, 1);

      expect(mediaItemService.getOrCreate).toHaveBeenCalledWith(row);
      expect(listMediaItemRepository.create).toHaveBeenCalledWith({
        listId: 'list-uuid',
        mediaItemId: mediaItem.id,
        userRating: 8,
        dateRated: new Date('2024-01-15'),
        position: 1,
      });
      expect(listMediaItemRepository.save).toHaveBeenCalledWith(listMediaItem);
    });

    it.each([
      ['Your Rating is missing', { 'Your Rating': '' }, { userRating: null }],
      ['Date Rated is missing', { 'Date Rated': '' }, { dateRated: null }],
      ['position is custom', {}, { position: 5 }],
    ])(
      'should handle when %s',
      async (_label, rowOverrides, expectedOverrides) => {
        const mediaItem = makeMediaItem();
        const listMediaItem = makeListMediaItem(
          expectedOverrides as Partial<ListMediaItem>,
        );

        mediaItemService.getOrCreate.mockResolvedValue(mediaItem as never);
        listMediaItemRepository.create.mockReturnValue(listMediaItem);
        listMediaItemRepository.save.mockResolvedValue(listMediaItem);

        const position =
          'position' in expectedOverrides ? expectedOverrides.position : 1;
        await service.add(
          'list-uuid',
          makeImdbRow(rowOverrides as Partial<IMDBRow>),
          position,
        );

        expect(listMediaItemRepository.create).toHaveBeenCalledWith(
          expect.objectContaining(expectedOverrides),
        );
      },
    );

    it.each([
      [
        'mediaItemService.getOrCreate throws',
        () =>
          mediaItemService.getOrCreate.mockRejectedValue(
            new Error('TMDB error'),
          ),
      ],
      [
        'repository.save throws',
        () => {
          mediaItemService.getOrCreate.mockResolvedValue(
            makeMediaItem() as never,
          );
          listMediaItemRepository.create.mockReturnValue(makeListMediaItem());
          listMediaItemRepository.save.mockRejectedValue(new Error('DB error'));
        },
      ],
    ])('should not throw when %s', async (_label, setup) => {
      setup();

      await expect(
        service.add('list-uuid', makeImdbRow(), 1),
      ).resolves.not.toThrow();
    });

    it('should not call repository when getOrCreate fails', async () => {
      mediaItemService.getOrCreate.mockRejectedValue(new Error('TMDB error'));

      await service.add('list-uuid', makeImdbRow(), 1);

      expect(listMediaItemRepository.create).not.toHaveBeenCalled();
      expect(listMediaItemRepository.save).not.toHaveBeenCalled();
    });
  });
});
