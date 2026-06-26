import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from '@google/generative-ai';
import {
  FileMetadataResponse,
  FileState,
  GoogleAIFileManager,
} from '@google/generative-ai/server';
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

const make503 = () =>
  Object.assign(
    new GoogleGenerativeAIFetchError('503', HttpStatus.SERVICE_UNAVAILABLE, ''),
    {
      status: HttpStatus.SERVICE_UNAVAILABLE,
    },
  );

type AiServiceInternals = { sleep: (ms: number) => Promise<void> };

const makeFileMetadata = (
  overrides: Partial<FileMetadataResponse> = {},
): FileMetadataResponse => ({
  name: 'fn',
  uri: 'fu',
  mimeType: 'text/csv',
  sizeBytes: '0',
  createTime: new Date().toISOString(),
  updateTime: new Date().toISOString(),
  expirationTime: new Date().toISOString(),
  sha256Hash: '',
  state: FileState.ACTIVE,
  ...overrides,
});

describe('AiService', () => {
  let service: AiService;
  let storageService: StorageService;
  let mockGenerateContent: jest.Mock;
  let mockFileManager: jest.Mocked<
    Pick<GoogleAIFileManager, 'uploadFile' | 'getFile' | 'deleteFile'>
  >;

  const mockList = {
    id: '1',
    name: 'Watchlist',
    totalItems: 5,
    file: { key: 'key' },
  } as List;

  const successResponse = (text = 'ok\n---JSON---\n[]') => ({
    response: { text: jest.fn().mockReturnValue(text) },
  });

  beforeEach(async () => {
    mockGenerateContent = jest.fn().mockResolvedValue(successResponse());

    mockFileManager = {
      uploadFile: jest
        .fn()
        .mockResolvedValue({ file: { name: 'fn', uri: 'fu' } }),
      getFile: jest.fn().mockResolvedValue(makeFileMetadata()),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest
        .fn()
        .mockReturnValue({ generateContent: mockGenerateContent }),
    }));
    (GoogleAIFileManager as jest.Mock).mockImplementation(
      () => mockFileManager,
    );

    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: geminiConfig.KEY, useValue: { apiKey: 'test-key' } },
        {
          provide: StorageService,
          useValue: { downloadFile: jest.fn().mockResolvedValue('csv') },
        },
        { provide: TranslationService, useValue: { t: (k: string) => k } },
      ],
    }).compile();

    service = module.get(AiService);
    storageService = module.get(StorageService);
    jest
      .spyOn(service as unknown as AiServiceInternals, 'sleep')
      .mockResolvedValue(undefined);
  });

  afterEach(() => jest.clearAllMocks());

  // --- happy path ---

  it('should return parsed recommendations on success', async () => {
    mockGenerateContent.mockResolvedValue(
      successResponse(
        'text\n---JSON---\n[{"title":"Inception","type":"movie","year":2010}]',
      ),
    );

    const result = await service.getRecommendations([mockList]);

    expect(result).toEqual({
      text: 'text',
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

  it('should return text-only when separator is absent', async () => {
    mockGenerateContent.mockResolvedValue(successResponse('plain text'));

    const result = await service.getRecommendations([mockList]);

    expect(result).toEqual({ text: 'plain text', recommendations: [] });
  });

  // --- retry & fallback ---

  it('should retry and succeed on second attempt within same model', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(make503())
      .mockResolvedValue(successResponse());

    await expect(service.getRecommendations([mockList])).resolves.toBeDefined();
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('should fallback to second model after exhausting retries on first', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(make503())
      .mockRejectedValueOnce(make503())
      .mockRejectedValueOnce(make503())
      .mockResolvedValue(successResponse());

    await expect(service.getRecommendations([mockList])).resolves.toBeDefined();
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
  });

  it('should throw ServiceUnavailableException when both models exhaust all retries', async () => {
    mockGenerateContent.mockRejectedValue(make503());

    await expect(service.getRecommendations([mockList])).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(6);
  });

  it('should not retry on non-retryable error and switch model immediately', async () => {
    const err = Object.assign(
      new GoogleGenerativeAIFetchError('400', HttpStatus.BAD_REQUEST, ''),
      { status: HttpStatus.BAD_REQUEST },
    );
    mockGenerateContent.mockRejectedValue(err);

    await expect(service.getRecommendations([mockList])).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // --- file lifecycle ---

  it('should throw when file download fails', async () => {
    jest
      .spyOn(storageService, 'downloadFile')
      .mockRejectedValueOnce(new Error('S3'));

    await expect(service.getRecommendations([mockList])).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw when Gemini upload fails', async () => {
    mockFileManager.uploadFile.mockRejectedValueOnce(new Error('upload'));

    await expect(service.getRecommendations([mockList])).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw when file processing state is FAILED', async () => {
    mockFileManager.getFile.mockResolvedValue(
      makeFileMetadata({ state: FileState.FAILED }),
    );
    await expect(service.getRecommendations([mockList])).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should delete uploaded files even when generation fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('fail'));

    await expect(service.getRecommendations([mockList])).rejects.toThrow();

    expect(mockFileManager.deleteFile).toHaveBeenCalledWith('fn');
  });

  it('should skip upload when lists is empty', async () => {
    await service.getRecommendations([]);

    expect(mockFileManager.uploadFile).not.toHaveBeenCalled();
  });

  // --- response parsing edge cases ---

  it('should throw when JSON after separator is invalid', async () => {
    mockGenerateContent.mockResolvedValue(
      successResponse('t\n---JSON---\nnot-json'),
    );

    await expect(service.getRecommendations([mockList])).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should default unknown media type to MOVIE', async () => {
    mockGenerateContent.mockResolvedValue(
      successResponse(
        't\n---JSON---\n[{"title":"X","type":"unknown","year":2020}]',
      ),
    );

    const result = await service.getRecommendations([mockList]);

    expect(result.recommendations[0].type).toBe(MediaType.MOVIE);
  });

  // --- conversation building ---

  it('should attach files to last user message and include media items in assistant message', async () => {
    const history: ChatMessage[] = [
      { id: '1', text: 'hi', author: MessageAuthor.USER } as ChatMessage,
      {
        id: '2',
        text: 'Sure!',
        author: MessageAuthor.ASSISTANT,
        mediaItems: [{ title: 'Inception', type: MediaType.MOVIE }],
      } as ChatMessage,
      { id: '3', text: 'more', author: MessageAuthor.USER } as ChatMessage,
    ];

    await service.getRecommendations([mockList], history);

    const { contents } = mockGenerateContent.mock.calls[0][0];
    const last = contents[contents.length - 1];
    const assistant = contents.find(
      (c: any) => c.role === messageAuthorToRole[MessageAuthor.ASSISTANT],
    );

    expect(last.parts[0].text).toBe('List name: "Watchlist"');
    expect(last.parts[1].fileData?.fileUri).toBe('fu');
    expect(assistant.parts[0].text).toContain('Inception (movie)');
  });
});
