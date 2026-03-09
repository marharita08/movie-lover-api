import { GoogleGenerativeAI } from '@google/generative-ai';
import { FileState, GoogleAIFileManager } from '@google/generative-ai/server';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';

import { ChatMessage, List, MediaType, MessageAuthor } from 'src/entities';

import { StorageService } from '../storage/storage.service';

import { AiService } from './ai.service';

jest.mock('@google/generative-ai');
jest.mock('@google/generative-ai/server');
jest.mock('fs/promises');

describe('AiService', () => {
  let service: AiService;
  let configService: ConfigService;
  let storageService: StorageService;
  let mockModel: any;
  let mockFileManager: any;

  const mockApiKey = 'test-api-key';

  beforeEach(async () => {
    mockModel = {
      generateContent: jest.fn(),
    };

    mockFileManager = {
      uploadFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    }));

    (GoogleAIFileManager as jest.Mock).mockImplementation(() => {
      return mockFileManager as GoogleAIFileManager;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GEMINI_API_KEY') return mockApiKey;
              return null;
            }),
          },
        },
        {
          provide: StorageService,
          useValue: {
            downloadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    configService = module.get<ConfigService>(ConfigService);
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if GEMINI_API_KEY is not configured', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      expect(() => {
        new AiService(configService, storageService);
      }).toThrow(InternalServerErrorException);
    });

    it('should initialize with correct API key', () => {
      expect(GoogleGenerativeAI).toHaveBeenCalledWith(mockApiKey);
      expect(GoogleAIFileManager).toHaveBeenCalledWith(mockApiKey);
    });
  });

  describe('getRecommendations', () => {
    const mockList = {
      id: '1',
      name: 'My Watchlist',
      totalItems: 10,
      file: {
        key: 'test-file-key',
      },
    } as List;

    const mockChatHistory: ChatMessage[] = [
      {
        id: '1',
        text: 'Recommend me something',
        author: MessageAuthor.USER,
      } as ChatMessage,
      {
        id: '2',
        text: 'Sure! Here are some recommendations',
        author: MessageAuthor.ASSISTANT,
        mediaItems: [
          {
            title: 'Inception',
            type: MediaType.MOVIE,
          },
        ],
      } as ChatMessage,
    ];

    beforeEach(() => {
      jest
        .spyOn(storageService, 'downloadFile')
        .mockResolvedValue('csv,content\nrow1,value1');

      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      mockFileManager.uploadFile.mockResolvedValue({
        file: {
          name: 'test-file-name',
          uri: 'test-file-uri',
        },
      });

      mockFileManager.getFile.mockResolvedValue({
        name: 'test-file-name',
        uri: 'test-file-uri',
        state: FileState.ACTIVE,
      });

      mockFileManager.deleteFile.mockResolvedValue(undefined);
    });

    it('should successfully get recommendations with files', async () => {
      const mockResponse = {
        response: {
          text: jest
            .fn()
            .mockReturnValue(
              'Here are my recommendations\n---JSON---\n```json\n[{"title":"Inception","year":2010,"type":"movie"}]\n```',
            ),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await service.getRecommendations(
        [mockList],
        mockChatHistory,
      );

      expect(result).toEqual({
        text: 'Here are my recommendations',
        recommendations: [
          {
            title: 'Inception',
            year: 2010,
            type: MediaType.MOVIE,
          },
        ],
      });

      expect(storageService.downloadFile).toHaveBeenCalledWith('test-file-key');
      expect(mockFileManager.uploadFile).toHaveBeenCalled();
      expect(mockModel.generateContent).toHaveBeenCalled();
      expect(mockFileManager.deleteFile).toHaveBeenCalledWith('test-file-name');
    });

    it('should handle recommendations without JSON separator', async () => {
      const mockResponse = {
        response: {
          text: jest
            .fn()
            .mockReturnValue(
              'Some text [{"title":"Inception","year":2010,"type":"movie"}]',
            ),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await service.getRecommendations([mockList]);

      expect(result).toEqual({
        text: 'Some text',
        recommendations: [
          {
            title: 'Inception',
            year: 2010,
            type: MediaType.MOVIE,
          },
        ],
      });
    });

    it('should handle empty lists', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('No recommendations\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await service.getRecommendations([], mockChatHistory);

      expect(result.recommendations).toEqual([]);
      expect(mockFileManager.uploadFile).not.toHaveBeenCalled();
    });

    it('should wait for file processing to complete', async () => {
      mockFileManager.getFile
        .mockResolvedValueOnce({
          name: 'test-file',
          state: FileState.PROCESSING,
        })
        .mockResolvedValueOnce({
          name: 'test-file',
          state: FileState.PROCESSING,
        })
        .mockResolvedValueOnce({
          name: 'test-file',
          uri: 'test-uri',
          state: FileState.ACTIVE,
        });

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Test\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await service.getRecommendations([mockList]);

      expect(mockFileManager.getFile).toHaveBeenCalledTimes(3);
    });

    it('should throw error if file processing fails', async () => {
      mockFileManager.getFile.mockResolvedValue({
        name: 'test-file',
        state: FileState.FAILED,
      });

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        'File processing failed: My Watchlist',
      );
    });

    it('should cleanup files even if generation fails', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(service.getRecommendations([mockList])).rejects.toThrow();

      expect(mockFileManager.deleteFile).toHaveBeenCalledWith('test-file-name');
    });

    it('should validate recommendations structure', async () => {
      const mockResponse = {
        response: {
          text: jest
            .fn()
            .mockReturnValue('Test\n---JSON---\n[{"title":"Movie"}]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should default invalid media type to MOVIE', async () => {
      const mockResponse = {
        response: {
          text: jest
            .fn()
            .mockReturnValue(
              'Test\n---JSON---\n[{"title":"Test","type":"invalid","year":2020}]',
            ),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await service.getRecommendations([mockList]);

      expect(result.recommendations[0].type).toBe(MediaType.MOVIE);
    });

    it('should include media items in conversation history', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Test\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await service.getRecommendations([mockList], mockChatHistory);

      const callArgs = mockModel.generateContent.mock.calls[0][0];
      const lastMessage = callArgs.contents[callArgs.contents.length - 1];

      expect(lastMessage.parts[0].text).toContain('Recommended:');
      expect(lastMessage.parts[0].text).toContain('Inception (movie)');
    });

    it('should add files to last user message', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Test\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await service.getRecommendations(
        [mockList],
        [
          {
            id: '1',
            text: 'User message',
            author: MessageAuthor.USER,
          } as ChatMessage,
        ],
      );

      const callArgs = mockModel.generateContent.mock.calls[0][0];
      const lastMessage = callArgs.contents[callArgs.contents.length - 1];

      expect(lastMessage.role).toBe('user');
      expect(lastMessage.parts[0].fileData).toBeDefined();
      expect(lastMessage.parts[0].fileData.fileUri).toBe('test-file-uri');
    });

    it('should handle temp file cleanup errors gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Unlink failed'));

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Test\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(
        service.getRecommendations([mockList]),
      ).resolves.toBeDefined();
    });

    it('should handle Gemini file deletion errors gracefully', async () => {
      mockFileManager.deleteFile.mockRejectedValue(new Error('Delete failed'));

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Test\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(
        service.getRecommendations([mockList]),
      ).resolves.toBeDefined();
    });

    it('should throw error if response cannot be parsed', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Invalid response without JSON'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle multiple lists', async () => {
      const mockLists = [
        {
          id: '1',
          name: 'List 1',
          totalItems: 10,
          file: { key: 'test-file-key-1' },
        } as List,
        {
          id: '2',
          name: 'List 2',
          totalItems: 15,
          file: { key: 'test-file-key-2' },
        } as List,
      ];

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Test\n---JSON---\n[]'),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await service.getRecommendations(mockLists);

      expect(storageService.downloadFile).toHaveBeenCalledTimes(2);
      expect(mockFileManager.uploadFile).toHaveBeenCalledTimes(2);
      expect(mockFileManager.deleteFile).toHaveBeenCalledTimes(2);
    });
  });
});
