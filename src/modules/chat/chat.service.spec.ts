import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TranslationKeys } from 'src/const/translations/keys';
import {
  ChatMessage,
  List,
  ListStatus,
  MediaType,
  MessageAuthor,
} from 'src/entities';
import { TranslationService } from 'src/modules/translation/translation.service';

import { AiService } from '../ai/ai.service';
import { ListService } from '../list/list.service';

import { ChatService } from './chat.service';
import { MediaSearchService } from './media-search.service';

describe('ChatService', () => {
  let service: ChatService;
  let chatMessageRepository: jest.Mocked<Repository<ChatMessage>>;
  let aiService: jest.Mocked<AiService>;
  let listService: jest.Mocked<ListService>;
  let mediaSearchService: jest.Mocked<MediaSearchService>;

  const mockUserId = 'user-uuid';
  const mockUser = { id: mockUserId, language: 'en-US' };

  const mockLists = {
    results: [
      { id: 'list-1', name: 'My Movies', status: ListStatus.COMPLETED } as List,
    ],
    totalPages: 1,
    page: 1,
    totalResults: 1,
  };

  const mockHistoryMessage = {
    id: 'msg-1',
    text: 'Previous message',
    author: MessageAuthor.USER,
  } as ChatMessage;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
        {
          provide: AiService,
          useValue: { getRecommendations: jest.fn() },
        },
        {
          provide: ListService,
          useValue: { findAll: jest.fn() },
        },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: MediaSearchService,
          useValue: { resolveMediaItem: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    chatMessageRepository = module.get(getRepositoryToken(ChatMessage));
    aiService = module.get(AiService);
    listService = module.get(ListService);
    mediaSearchService = module.get(MediaSearchService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('processUserMessage', () => {
    beforeEach(() => {
      listService.findAll.mockResolvedValue(mockLists);
      chatMessageRepository.create.mockImplementation(
        (data: any) => data as ChatMessage,
      );
      chatMessageRepository.save.mockImplementation((msg) =>
        Promise.resolve(msg as ChatMessage),
      );
      chatMessageRepository.count.mockResolvedValue(1);
      chatMessageRepository.find.mockResolvedValue([mockHistoryMessage]);
    });

    it('should save user message, call AI with lists and history, save assistant response', async () => {
      const mockAiResponse = {
        text: 'Here are my recommendations',
        recommendations: [
          {
            title: 'Inception',
            original_title: 'Inception',
            year: 2010,
            type: MediaType.MOVIE,
          },
        ],
      };
      const mockMediaItem = {
        id: 123,
        title: 'Inception',
        posterPath: '/poster.jpg',
        type: MediaType.MOVIE,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      mediaSearchService.resolveMediaItem.mockResolvedValue(
        mockMediaItem as never,
      );

      await service.processUserMessage(
        mockUser as never,
        'Recommend me a movie',
      );

      expect(chatMessageRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        text: 'Recommend me a movie',
        author: MessageAuthor.USER,
        mediaItems: null,
      });

      expect(listService.findAll).toHaveBeenCalledWith(
        { status: ListStatus.COMPLETED, page: 1, limit: 10 },
        mockUserId,
      );

      expect(aiService.getRecommendations).toHaveBeenCalledWith(
        mockLists.results,
        [mockHistoryMessage],
      );

      expect(mediaSearchService.resolveMediaItem).toHaveBeenCalledWith(
        mockAiResponse.recommendations[0],
        mockUser.language,
      );

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          text: mockAiResponse.text,
          author: MessageAuthor.ASSISTANT,
          mediaItems: [mockMediaItem],
          isError: false,
        }),
      );
    });

    it('should save assistant message without mediaItems when AI returns no recommendations', async () => {
      aiService.getRecommendations.mockResolvedValue({
        text: 'I have no recommendations',
        recommendations: [],
      });

      await service.processUserMessage(mockUser as never, 'Hi');

      expect(mediaSearchService.resolveMediaItem).not.toHaveBeenCalled();

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: 'I have no recommendations',
          author: MessageAuthor.ASSISTANT,
          mediaItems: null,
          isError: false,
        }),
      );
    });

    it('should include only successful media items when some resolveMediaItem calls fail', async () => {
      const mockAiResponse = {
        text: 'Recommendations',
        recommendations: [
          {
            title: 'Inception',
            original_title: 'Inception',
            year: 2010,
            type: MediaType.MOVIE,
          },
          {
            title: 'Unknown',
            original_title: 'Unknown',
            year: 2020,
            type: MediaType.MOVIE,
          },
        ],
      };
      const mockMediaItem = {
        id: 123,
        title: 'Inception',
        posterPath: '/poster.jpg',
        type: MediaType.MOVIE,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      mediaSearchService.resolveMediaItem
        .mockResolvedValueOnce(mockMediaItem as never)
        .mockRejectedValueOnce(new Error('Not found'));

      await service.processUserMessage(mockUser as never, 'Test');

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: mockAiResponse.text,
          mediaItems: [mockMediaItem],
          isError: false,
        }),
      );
    });

    it('should save error message when all resolveMediaItem calls fail', async () => {
      aiService.getRecommendations.mockResolvedValue({
        text: 'Recommendations',
        recommendations: [
          {
            title: 'Unknown 1',
            original_title: 'Unknown 1',
            year: 2020,
            type: MediaType.MOVIE,
          },
          {
            title: 'Unknown 2',
            original_title: 'Unknown 1',
            year: 2021,
            type: MediaType.MOVIE,
          },
        ],
      });

      mediaSearchService.resolveMediaItem.mockRejectedValue(
        new Error('Not found'),
      );

      await service.processUserMessage(mockUser as never, 'Test');

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: TranslationKeys.ERROR_RECOMMENDATIONS_FAILED,
          mediaItems: null,
          isError: true,
        }),
      );
    });
  });

  describe('getChatHistory', () => {
    it('should return paginated chat history', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          text: 'Message 1',
          author: MessageAuthor.USER,
        } as ChatMessage,
        {
          id: 'msg-2',
          text: 'Message 2',
          author: MessageAuthor.ASSISTANT,
        } as ChatMessage,
      ];

      chatMessageRepository.count.mockResolvedValue(2);
      chatMessageRepository.find.mockResolvedValue(mockMessages);

      const result = await service.getChatHistory(mockUserId, {
        page: 1,
        limit: 20,
      });

      expect(chatMessageRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        page: 1,
        results: mockMessages,
        totalPages: 1,
        totalResults: 2,
      });
    });

    it('should calculate skip and totalPages correctly for page > 1', async () => {
      chatMessageRepository.count.mockResolvedValue(50);
      chatMessageRepository.find.mockResolvedValue([]);

      const result = await service.getChatHistory(mockUserId, {
        page: 3,
        limit: 20,
      });

      expect(chatMessageRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.totalPages).toBe(3);
    });

    it('should use default pagination values when not provided', async () => {
      chatMessageRepository.count.mockResolvedValue(5);
      chatMessageRepository.find.mockResolvedValue([]);

      await service.getChatHistory(mockUserId, {});

      expect(chatMessageRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should create and return welcome message when no history exists', async () => {
      const welcomeMsg = {
        userId: mockUserId,
        text: TranslationKeys.CHAT_WELCOME_MESSAGE,
        author: MessageAuthor.ASSISTANT,
        mediaItems: null,
      } as ChatMessage;

      chatMessageRepository.count.mockResolvedValue(0);
      chatMessageRepository.create.mockReturnValue(welcomeMsg);
      chatMessageRepository.save.mockResolvedValue(welcomeMsg);

      const result = await service.getChatHistory(mockUserId, {
        page: 1,
        limit: 20,
      });

      expect(chatMessageRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        text: TranslationKeys.CHAT_WELCOME_MESSAGE,
        author: MessageAuthor.ASSISTANT,
        mediaItems: null,
      });
      expect(result).toEqual({
        page: 1,
        results: [welcomeMsg],
        totalPages: 1,
        totalResults: 1,
      });
    });
  });

  describe('clearChatHistory', () => {
    it('should delete all messages for user', async () => {
      chatMessageRepository.delete.mockResolvedValue({ affected: 5, raw: {} });

      await service.clearChatHistory(mockUserId);

      expect(chatMessageRepository.delete).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });
  });
});
