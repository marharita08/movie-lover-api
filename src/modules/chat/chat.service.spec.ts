import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ChatMessage,
  List,
  ListStatus,
  MediaType,
  MessageAuthor,
} from 'src/entities';

import { AiService } from '../ai/ai.service';
import { ListService } from '../list/list.service';
import { TmdbService } from '../tmdb/tmdb.service';

import { ChatService } from './chat.service';
import { WELCOME_MESSAGE } from './const';

describe('ChatService', () => {
  let service: ChatService;
  let chatMessageRepository: jest.Mocked<Repository<ChatMessage>>;
  let aiService: jest.Mocked<AiService>;
  let listService: jest.Mocked<ListService>;
  let tmdbService: jest.Mocked<TmdbService>;

  const mockUserId = 'user-uuid';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: AiService,
          useValue: {
            getRecommendations: jest.fn(),
          },
        },
        {
          provide: ListService,
          useValue: {
            findAll: jest.fn(),
          },
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
          provide: TmdbService,
          useValue: {
            searchMovies: jest.fn(),
            searchTVShows: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    chatMessageRepository = module.get(getRepositoryToken(ChatMessage));
    aiService = module.get(AiService);
    listService = module.get(ListService);
    tmdbService = module.get(TmdbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processUserMessage', () => {
    const mockLists = {
      results: [
        {
          id: 'list-1',
          name: 'My Movies',
          status: ListStatus.COMPLETED,
        } as List,
      ],
      totalPages: 1,
      page: 1,
      totalResults: 1,
    };

    const mockChatHistory = {
      results: [
        {
          id: 'msg-1',
          text: 'Previous message',
          author: MessageAuthor.USER,
        } as ChatMessage,
      ],
      totalPages: 1,
      page: 1,
      totalResults: 1,
    };

    beforeEach(() => {
      listService.findAll.mockResolvedValue(mockLists);
      chatMessageRepository.create.mockImplementation(
        (data: any) => data as ChatMessage,
      );
      chatMessageRepository.save.mockImplementation((msg) =>
        Promise.resolve(msg as ChatMessage),
      );
      chatMessageRepository.count.mockResolvedValue(1);
      chatMessageRepository.find.mockResolvedValue(mockChatHistory.results);
    });

    it('should process user message and return AI response with movie recommendations', async () => {
      const mockAiResponse = {
        text: 'Here are my recommendations',
        recommendations: [
          { title: 'Inception', year: 2010, type: MediaType.MOVIE },
        ],
      };

      const mockMovieSearchResult = {
        results: [
          {
            id: 123,
            adult: false,
            backdropPath: '/backdrop.jpg',
            genreIds: [28, 12],
            originalLanguage: 'en',
            originalTitle: 'Inception',
            overview: 'A thief who steals corporate secrets...',
            popularity: 29.780826,
            posterPath: '/poster.jpg',
            releaseDate: '2010-07-16',
            title: 'Inception',
            video: false,
            voteAverage: 8.4,
            voteCount: 14075,
          },
        ],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchMovies.mockResolvedValue(mockMovieSearchResult);

      await service.processUserMessage(mockUserId, 'Recommend me a movie');

      expect(chatMessageRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        text: 'Recommend me a movie',
        author: MessageAuthor.USER,
        mediaItems: null,
      });
      expect(chatMessageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          text: 'Recommend me a movie',
          author: MessageAuthor.USER,
        }),
      );

      // Verify lists were fetched
      expect(listService.findAll).toHaveBeenCalledWith(
        { status: ListStatus.COMPLETED, page: 1, limit: 10 },
        mockUserId,
      );

      // Verify AI was called with correct data
      expect(aiService.getRecommendations).toHaveBeenCalledWith(
        mockLists.results,
        mockChatHistory.results,
      );

      // Verify TMDB search was called
      expect(tmdbService.searchMovies).toHaveBeenCalledWith({
        query: 'Inception',
        year: 2010,
      });

      // Verify AI response was saved
      expect(chatMessageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          text: 'Here are my recommendations',
          author: MessageAuthor.ASSISTANT,
          mediaItems: [
            {
              type: MediaType.MOVIE,
              id: 123,
              title: 'Inception',
              posterPath: '/poster.jpg',
            },
          ],
          isError: false,
        }),
      );
    });

    it('should process TV show recommendations', async () => {
      const mockAiResponse = {
        text: 'Check out these TV shows',
        recommendations: [
          { title: 'Breaking Bad', year: 2008, type: MediaType.TV },
        ],
      };

      const mockTVSearchResult = {
        results: [
          {
            id: 456,
            adult: false,
            backdropPath: '/backdrop.jpg',
            genreIds: [18, 80],
            originCountry: ['US'],
            originalLanguage: 'en',
            originalName: 'Breaking Bad',
            overview: 'A high school chemistry teacher...',
            popularity: 369.594,
            posterPath: '/tv-poster.jpg',
            firstAirDate: '2008-01-20',
            name: 'Breaking Bad',
            voteAverage: 8.9,
            voteCount: 12345,
          },
        ],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchTVShows.mockResolvedValue(mockTVSearchResult);

      await service.processUserMessage(mockUserId, 'Recommend TV shows');

      expect(tmdbService.searchTVShows).toHaveBeenCalledWith({
        query: 'Breaking Bad',
        year: 2008,
      });

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mediaItems: [
            {
              type: MediaType.TV,
              id: 456,
              title: 'Breaking Bad',
              posterPath: '/tv-poster.jpg',
            },
          ],
        }),
      );
    });

    it('should handle mixed movie and TV recommendations', async () => {
      const mockAiResponse = {
        text: 'Mixed recommendations',
        recommendations: [
          { title: 'Inception', year: 2010, type: MediaType.MOVIE },
          { title: 'Breaking Bad', year: 2008, type: MediaType.TV },
        ],
      };

      const mockMovieSearchResult = {
        results: [
          {
            id: 123,
            adult: false,
            backdropPath: null,
            genreIds: [28],
            originalLanguage: 'en',
            originalTitle: 'Inception',
            overview: 'Overview',
            popularity: 29.78,
            posterPath: '/movie.jpg',
            releaseDate: '2010-07-16',
            title: 'Inception',
            video: false,
            voteAverage: 8.4,
            voteCount: 14075,
          },
        ],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };

      const mockTVSearchResult = {
        results: [
          {
            id: 456,
            adult: false,
            backdropPath: null,
            genreIds: [18],
            originCountry: ['US'],
            originalLanguage: 'en',
            originalName: 'Breaking Bad',
            overview: 'Overview',
            popularity: 369.59,
            posterPath: '/tv.jpg',
            firstAirDate: '2008-01-20',
            name: 'Breaking Bad',
            voteAverage: 8.9,
            voteCount: 12345,
          },
        ],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchMovies.mockResolvedValue(mockMovieSearchResult);
      tmdbService.searchTVShows.mockResolvedValue(mockTVSearchResult);

      await service.processUserMessage(mockUserId, 'Mixed recommendations');

      expect(tmdbService.searchMovies).toHaveBeenCalledTimes(1);
      expect(tmdbService.searchTVShows).toHaveBeenCalledTimes(1);

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mediaItems: expect.arrayContaining([
            expect.objectContaining({ type: MediaType.MOVIE, id: 123 }),
            expect.objectContaining({ type: MediaType.TV, id: 456 }),
          ]),
        }),
      );
    });

    it('should handle when movie is not found in TMDB', async () => {
      const mockAiResponse = {
        text: 'Recommendations',
        recommendations: [
          { title: 'Unknown Movie', year: 2020, type: MediaType.MOVIE },
        ],
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchMovies.mockResolvedValue({
        results: [],
        page: 1,
        totalPages: 0,
        totalResults: 0,
      });

      await service.processUserMessage(mockUserId, 'Test message');

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: 'An error occurred while generating recommendations. Please try again.',
          mediaItems: null,
          isError: true,
        }),
      );
    });

    it('should handle partial failures gracefully', async () => {
      const mockAiResponse = {
        text: 'Recommendations',
        recommendations: [
          { title: 'Inception', year: 2010, type: MediaType.MOVIE },
          { title: 'Unknown Movie', year: 2020, type: MediaType.MOVIE },
        ],
      };

      const mockMovieSearchResult = {
        results: [
          {
            id: 123,
            adult: false,
            backdropPath: null,
            genreIds: [28],
            originalLanguage: 'en',
            originalTitle: 'Inception',
            overview: 'Overview',
            popularity: 29.78,
            posterPath: '/poster.jpg',
            releaseDate: '2010-07-16',
            title: 'Inception',
            video: false,
            voteAverage: 8.4,
            voteCount: 14075,
          },
        ],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchMovies
        .mockResolvedValueOnce(mockMovieSearchResult)
        .mockResolvedValueOnce({
          results: [],
          page: 1,
          totalPages: 0,
          totalResults: 0,
        });

      await service.processUserMessage(mockUserId, 'Test message');

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: 'Recommendations',
          mediaItems: [
            {
              type: MediaType.MOVIE,
              id: 123,
              title: 'Inception',
              posterPath: '/poster.jpg',
            },
          ],
          isError: false,
        }),
      );
    });

    it('should handle null poster paths', async () => {
      const mockAiResponse = {
        text: 'Recommendations',
        recommendations: [
          { title: 'Movie Without Poster', year: 2020, type: MediaType.MOVIE },
        ],
      };

      const mockMovieSearchResult = {
        results: [
          {
            id: 789,
            adult: false,
            backdropPath: null,
            genreIds: [28],
            originalLanguage: 'en',
            originalTitle: 'Movie Without Poster',
            overview: 'Overview',
            popularity: 29.78,
            posterPath: null,
            releaseDate: '2020-01-01',
            title: 'Movie Without Poster',
            video: false,
            voteAverage: 7.0,
            voteCount: 1000,
          },
        ],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchMovies.mockResolvedValue(mockMovieSearchResult);

      await service.processUserMessage(mockUserId, 'Test');

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mediaItems: [
            expect.objectContaining({
              posterPath: null,
            }),
          ],
        }),
      );
    });

    it('should return error message when all recommendations fail', async () => {
      const mockAiResponse = {
        text: 'Recommendations',
        recommendations: [
          { title: 'Unknown 1', year: 2020, type: MediaType.MOVIE },
          { title: 'Unknown 2', year: 2021, type: MediaType.MOVIE },
        ],
      };

      aiService.getRecommendations.mockResolvedValue(mockAiResponse);
      tmdbService.searchMovies.mockResolvedValue({
        results: [],
        page: 1,
        totalPages: 0,
        totalResults: 0,
      });

      await service.processUserMessage(mockUserId, 'Test');

      expect(chatMessageRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: 'An error occurred while generating recommendations. Please try again.',
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
          userId: mockUserId,
          text: 'Message 1',
          author: MessageAuthor.USER,
        } as ChatMessage,
        {
          id: 'msg-2',
          userId: mockUserId,
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

      expect(chatMessageRepository.count).toHaveBeenCalledWith({
        where: { userId: mockUserId },
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

    it('should handle pagination correctly', async () => {
      const mockMessages = [{ id: 'msg-1', text: 'Message 1' } as ChatMessage];

      chatMessageRepository.count.mockResolvedValue(50);
      chatMessageRepository.find.mockResolvedValue(mockMessages);

      const result = await service.getChatHistory(mockUserId, {
        page: 3,
        limit: 20,
      });

      expect(chatMessageRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        skip: 40, // (3 - 1) * 20
        take: 20,
      });
      expect(result.totalPages).toBe(3); // Math.ceil(50 / 20)
      expect(result.page).toBe(3);
    });

    it('should use default pagination values', async () => {
      chatMessageRepository.count.mockResolvedValue(5);
      chatMessageRepository.find.mockResolvedValue([]);

      await service.getChatHistory(mockUserId, {});

      expect(chatMessageRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        skip: 0, // (1 - 1) * 20
        take: 20,
      });
    });

    it('should create welcome message when no history exists', async () => {
      const welcomeMsg = {
        id: 'welcome-1',
        userId: mockUserId,
        text: WELCOME_MESSAGE,
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
        text: WELCOME_MESSAGE,
        author: MessageAuthor.ASSISTANT,
        mediaItems: null,
      });
      expect(chatMessageRepository.save).toHaveBeenCalledWith(welcomeMsg);
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
      chatMessageRepository.delete.mockResolvedValue({
        affected: 5,
        raw: {},
      });

      await service.clearChatHistory(mockUserId);

      expect(chatMessageRepository.delete).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });

    it('should handle when no messages exist', async () => {
      chatMessageRepository.delete.mockResolvedValue({
        affected: 0,
        raw: {},
      });

      await service.clearChatHistory(mockUserId);

      expect(chatMessageRepository.delete).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });
  });
});
