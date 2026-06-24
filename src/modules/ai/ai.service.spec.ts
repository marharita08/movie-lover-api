import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from '@google/generative-ai';
import { FileState, GoogleAIFileManager } from '@google/generative-ai/server';
import {
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';

import { geminiConfig } from 'src/config';
import { messageAuthorToRole } from 'src/const/message-author-to-role';
import { ChatMessage, List, MediaType, MessageAuthor } from 'src/entities';

import { StorageService } from '../storage/storage.service';
import { TranslationService } from '../translation/translation.service';

import { AiService } from './ai.service';

jest.mock('@google/generative-ai');
jest.mock('@google/generative-ai/server');
jest.mock('fs/promises');

describe('AiService', () => {
  let service: AiService;
  let storageService: StorageService;
  let mockModel: any;
  let mockFileManager: any;

  const mockList = {
    id: '1',
    name: 'My Watchlist',
    totalItems: 10,
    file: { key: 'test-file-key' },
  } as List;

  const mockChatHistory: ChatMessage[] = [
    {
      id: '1',
      text: 'Recommend me something',
      author: MessageAuthor.USER,
    } as ChatMessage,
    {
      id: '2',
      text: 'Sure!',
      author: MessageAuthor.ASSISTANT,
      mediaItems: [{ title: 'Inception', type: MediaType.MOVIE }],
    } as ChatMessage,
  ];

  beforeEach(async () => {
    mockModel = { generateContent: jest.fn() };

    mockFileManager = {
      uploadFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    }));

    (GoogleAIFileManager as jest.Mock).mockImplementation(
      () => mockFileManager as GoogleAIFileManager,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: geminiConfig.KEY,
          useValue: { apiKey: 'test-api-key' },
        },
        {
          provide: StorageService,
          useValue: { downloadFile: jest.fn() },
        },
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    storageService = module.get<StorageService>(StorageService);

    jest
      .spyOn(storageService, 'downloadFile')
      .mockResolvedValue('csv,content\nrow1,value1');

    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    mockFileManager.uploadFile.mockResolvedValue({
      file: { name: 'test-file-name', uri: 'test-file-uri' },
    });
    mockFileManager.getFile.mockResolvedValue({
      name: 'test-file-name',
      uri: 'test-file-uri',
      state: FileState.ACTIVE,
    });
    mockFileManager.deleteFile.mockResolvedValue(undefined);
  });

  afterEach(() => jest.clearAllMocks());

  // --- file upload lifecycle ---

  describe('uploadListFiles (via getRecommendations)', () => {
    it('should throw InternalServerErrorException when file download fails', async () => {
      jest
        .spyOn(storageService, 'downloadFile')
        .mockRejectedValueOnce(new Error('S3 error'));

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when Gemini upload fails', async () => {
      mockFileManager.uploadFile.mockRejectedValueOnce(
        new Error('Upload error'),
      );

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should poll until file state becomes ACTIVE', async () => {
      mockFileManager.getFile
        .mockResolvedValueOnce({ name: 'f', state: FileState.PROCESSING })
        .mockResolvedValueOnce({ name: 'f', state: FileState.PROCESSING })
        .mockResolvedValueOnce({
          name: 'f',
          uri: 'uri',
          state: FileState.ACTIVE,
        });

      mockModel.generateContent.mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('t\n---JSON---\n[]') },
      });

      await service.getRecommendations([mockList]);

      expect(mockFileManager.getFile).toHaveBeenCalledTimes(3);
    });

    it('should throw InternalServerErrorException when file state is FAILED', async () => {
      mockFileManager.getFile.mockResolvedValue({
        name: 'f',
        state: FileState.FAILED,
      });

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should upload and delete files for each list', async () => {
      const lists = [
        { id: '1', name: 'L1', totalItems: 5, file: { key: 'k1' } } as List,
        { id: '2', name: 'L2', totalItems: 3, file: { key: 'k2' } } as List,
      ];

      mockModel.generateContent.mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('t\n---JSON---\n[]') },
      });

      await service.getRecommendations(lists);

      expect(mockFileManager.uploadFile).toHaveBeenCalledTimes(2);
      expect(mockFileManager.deleteFile).toHaveBeenCalledTimes(2);
    });
  });

  // --- getRecommendations orchestration ---

  describe('getRecommendations', () => {
    it('should skip file upload when lists array is empty', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('t\n---JSON---\n[]') },
      });

      await service.getRecommendations([], mockChatHistory);

      expect(mockFileManager.uploadFile).not.toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when Gemini API returns 503', async () => {
      const err = Object.assign(
        new (GoogleGenerativeAIFetchError as any)('Service Unavailable'),
        { status: HttpStatus.SERVICE_UNAVAILABLE },
      );
      mockModel.generateContent.mockRejectedValue(err);

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should delete uploaded files even when content generation fails', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(service.getRecommendations([mockList])).rejects.toThrow();

      expect(mockFileManager.deleteFile).toHaveBeenCalledWith('test-file-name');
    });

    it('should not throw when Gemini file deletion fails', async () => {
      mockFileManager.deleteFile.mockRejectedValue(new Error('Delete failed'));

      mockModel.generateContent.mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('t\n---JSON---\n[]') },
      });

      await expect(
        service.getRecommendations([mockList]),
      ).resolves.toBeDefined();
    });
  });

  // --- response parsing ---

  describe('parseResponse (via getRecommendations)', () => {
    const respond = (text: string): void => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: jest.fn().mockReturnValue(text) },
      });
    };

    it('should return text and recommendations with original_title when separator is present', async () => {
      respond(
        'Here are recommendations\n---JSON---\n```json\n[{"title":"Inception","original_title":"Inception","year":2010,"type":"movie"}]\n```',
      );

      const result = await service.getRecommendations([mockList]);

      expect(result).toEqual({
        text: 'Here are recommendations',
        recommendations: [
          {
            title: 'Inception',
            original_title: 'Inception',
            year: 2010,
            type: MediaType.MOVIE,
          },
        ],
      });
    });

    it('should fall back to title when original_title is missing', async () => {
      respond('t\n---JSON---\n[{"title":"Dune","type":"movie","year":2021}]');

      const result = await service.getRecommendations([mockList]);

      expect(result.recommendations[0].original_title).toBe('Dune');
    });

    it('should return text-only response when separator is absent', async () => {
      respond('Plain text with no separator');

      const result = await service.getRecommendations([mockList]);

      expect(result).toEqual({
        text: 'Plain text with no separator',
        recommendations: [],
      });
    });

    it('should throw InternalServerErrorException when JSON after separator is invalid', async () => {
      respond('t\n---JSON---\nnot-valid-json');

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when recommendation is missing required fields', async () => {
      respond('t\n---JSON---\n[{"title":"Movie"}]');

      await expect(service.getRecommendations([mockList])).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should default unknown media type to MOVIE', async () => {
      respond('t\n---JSON---\n[{"title":"Test","type":"unknown","year":2020}]');

      const result = await service.getRecommendations([mockList]);

      expect(result.recommendations[0].type).toBe(MediaType.MOVIE);
    });
  });

  // --- conversation content building ---

  describe('conversation content building', () => {
    const respond = (): void => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('t\n---JSON---\n[]') },
      });
    };

    it('should append media items to assistant messages', async () => {
      respond();

      await service.getRecommendations([mockList], mockChatHistory);

      const contents = mockModel.generateContent.mock.calls[0][0].contents;
      const assistantMsg = contents.find(
        (c: any) => c.role === messageAuthorToRole[MessageAuthor.ASSISTANT],
      );

      expect(assistantMsg.parts[0].text).toContain('Inception (movie)');
    });

    it('should attach uploaded files to the last user message', async () => {
      respond();

      await service.getRecommendations(
        [mockList],
        [{ id: '1', text: 'hello', author: MessageAuthor.USER } as ChatMessage],
      );

      const contents = mockModel.generateContent.mock.calls[0][0].contents;
      const last = contents[contents.length - 1];

      expect(last.role).toBe(messageAuthorToRole[MessageAuthor.USER]);
      expect(last.parts[0].fileData?.fileUri).toBe('test-file-uri');
    });

    it('should not add files when history is empty', async () => {
      respond();

      await service.getRecommendations([mockList], []);

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ contents: [] }),
      );
    });

    it('should not add files when last message is not from user', async () => {
      respond();

      const historyEndingWithAssistant: ChatMessage[] = [
        { id: '1', text: 'hi', author: MessageAuthor.USER } as ChatMessage,
        {
          id: '2',
          text: 'hello',
          author: MessageAuthor.ASSISTANT,
        } as ChatMessage,
      ];

      await service.getRecommendations([mockList], historyEndingWithAssistant);

      const contents = mockModel.generateContent.mock.calls[0][0].contents;
      const last = contents[contents.length - 1];

      expect(last.parts[0].fileData).toBeUndefined();
    });
  });
});
