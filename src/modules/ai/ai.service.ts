import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from '@google/generative-ai';
import { FileState, GoogleAIFileManager } from '@google/generative-ai/server';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { geminiConfig } from 'src/config';
import { messageAuthorToRole } from 'src/const/message-author-to-role';
import { TranslationKeys } from 'src/const/translations/keys';
import { ChatMessage, List, MediaType, MessageAuthor } from 'src/entities';

import { StorageService } from '../storage/storage.service';
import { TranslationService } from '../translation/translation.service';

import {
  FILE_PROCESSING_POLL_INTERVAL_MS,
  FILE_PROCESSING_TIMEOUT_MS,
  GeminiModel,
  GENERATE_TIMEOUT_MS,
  RETRIES_PER_MODEL,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  RETRYABLE_STATUSES,
} from './const/const';
import { AIRecommendationItemDto } from './dto/ai-recommendation-item.dto';
import { AIRecommendationResponseDto } from './dto/ai-recommendation-response.dto';
import {
  JSON_SEPARATOR,
  LISTS_CONTEXT_NO_FILES,
  LISTS_CONTEXT_WITH_FILES,
  RECOMMENDATIONS_PROMPT,
} from './prompts/recommendations.prompt';

interface UploadedFile {
  uri: string;
  name: string;
}

interface ModelConfig {
  name: string;
  instance: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private fileManager: GoogleAIFileManager;
  private models: ModelConfig[];

  constructor(
    private storageService: StorageService,
    private readonly i18n: TranslationService,
    @Inject(geminiConfig.KEY)
    private readonly config: ConfigType<typeof geminiConfig>,
  ) {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    this.fileManager = new GoogleAIFileManager(config.apiKey);

    const modelOptions = {
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
      tools: [{ google_search: {} } as any],
    };

    this.models = [
      {
        name: GeminiModel.FLASH,
        instance: genAI.getGenerativeModel({
          model: GeminiModel.FLASH,
          ...modelOptions,
        }),
      },
      {
        name: GeminiModel.FLASH_LITE,
        instance: genAI.getGenerativeModel({
          model: GeminiModel.FLASH_LITE,
          ...modelOptions,
        }),
      },
    ];
  }

  async getRecommendations(
    userLists: List[],
    chatHistory: ChatMessage[] = [],
  ): Promise<AIRecommendationResponseDto> {
    let uploadedFiles: UploadedFile[] = [];

    try {
      uploadedFiles = await this.uploadListFiles(userLists);

      const systemPrompt = this.buildSystemPromptWithFiles(
        userLists.length,
        userLists.reduce((sum, list) => sum + list.totalItems, 0),
      );

      const conversationHistory = this.buildConversationHistory(chatHistory);
      const contentsWithFiles = this.addFilesToHistory(
        conversationHistory,
        uploadedFiles,
      );

      const fullText = await this.generateContentWithFallback(
        contentsWithFiles,
        systemPrompt,
      );

      return this.parseResponse(fullText);
    } finally {
      await this.cleanupGeminiFiles(uploadedFiles);
    }
  }

  private async generateContentWithFallback(
    contents: Array<{ role: string; parts: Array<any> }>,
    systemInstruction: string,
  ): Promise<string> {
    let lastError: HttpException | undefined;

    for (const model of this.models) {
      this.logger.debug(`Trying model: ${model.name}`);

      for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
        try {
          const text = await this.generateWithTimeout(
            model,
            contents,
            systemInstruction,
          );
          this.logger.debug(
            `Success on model=${model.name} attempt=${attempt}`,
          );
          return text;
        } catch (error) {
          const mapped = this.mapGeminiError(error, model.name);
          lastError = mapped;

          const isRetryable = this.isRetryableError(error);
          const isLastAttempt = attempt === RETRIES_PER_MODEL;

          if (!isRetryable || isLastAttempt) {
            this.logger.warn(
              `Model ${model.name} exhausted (retryable=${isRetryable}, attempt=${attempt}).`,
            );
            break;
          }

          const delay = this.calcDelay(attempt);
          this.logger.warn(
            `Model ${model.name} attempt=${attempt} failed — retrying in ${delay}ms`,
          );
          await this.sleep(delay);
        }
      }
    }

    throw (
      lastError ??
      new InternalServerErrorException(
        this.i18n.t(TranslationKeys.ERROR_AI_UNEXPECTED_ERROR),
      )
    );
  }

  private async generateWithTimeout(
    model: ModelConfig,
    contents: Array<{ role: string; parts: Array<any> }>,
    systemInstruction: string,
  ): Promise<string> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const generatePromise = model.instance.generateContent({
      contents,
      systemInstruction,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () =>
          reject(
            new GoogleGenerativeAIFetchError(
              `Request to ${model.name} timed out after ${GENERATE_TIMEOUT_MS}ms`,
              HttpStatus.SERVICE_UNAVAILABLE,
              'timeout',
            ),
          ),
        GENERATE_TIMEOUT_MS,
      );
    });

    try {
      const result = await Promise.race([generatePromise, timeoutPromise]);
      return result.response.text();
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private calcDelay(attempt: number): number {
    const base = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    const jitter = Math.random() * 500;
    return Math.min(base + jitter, RETRY_MAX_DELAY_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof GoogleGenerativeAIFetchError) {
      return RETRYABLE_STATUSES.has(error.status as HttpStatus);
    }
    return false;
  }

  private mapGeminiError(error: unknown, modelName: string): HttpException {
    if (error instanceof GoogleGenerativeAIFetchError) {
      const status = error.status;

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        this.logger.warn(`[${modelName}] Rate limit exceeded`);
        return new HttpException(
          this.i18n.t(TranslationKeys.ERROR_AI_RATE_LIMIT),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status === HttpStatus.BAD_REQUEST) {
        const isSafetyBlock = error.message?.toLowerCase().includes('safety');
        if (isSafetyBlock) {
          this.logger.warn(`[${modelName}] Request blocked by safety filters`);
          return new BadRequestException(
            this.i18n.t(TranslationKeys.ERROR_AI_SAFETY_BLOCK),
          );
        }
        this.logger.error(`[${modelName}] Bad request`, error.message);
        return new InternalServerErrorException(
          this.i18n.t(TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE),
        );
      }

      if (
        status === HttpStatus.UNAUTHORIZED ||
        status === HttpStatus.FORBIDDEN
      ) {
        this.logger.error(
          `[${modelName}] Auth error (${status}) — check GEMINI_API_KEY`,
        );
        return new InternalServerErrorException(
          this.i18n.t(TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE),
        );
      }

      if (
        status === HttpStatus.INTERNAL_SERVER_ERROR ||
        status === HttpStatus.SERVICE_UNAVAILABLE
      ) {
        this.logger.error(`[${modelName}] Server error (${status})`);
        return new ServiceUnavailableException(
          this.i18n.t(TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE),
        );
      }

      this.logger.error(
        `[${modelName}] Unhandled error (${status})`,
        error.message,
      );
      return new InternalServerErrorException(
        this.i18n.t(TranslationKeys.ERROR_AI_UNEXPECTED_ERROR),
      );
    }

    this.logger.error(`[${modelName}] Unexpected error`, error);
    return new InternalServerErrorException(
      this.i18n.t(TranslationKeys.ERROR_AI_UNEXPECTED_ERROR),
    );
  }

  private async uploadListFiles(userLists: List[]): Promise<UploadedFile[]> {
    const uploadPromises = userLists.map(async (list) => {
      try {
        let csvContent: string;
        try {
          csvContent = await this.storageService.downloadFile(list.file.key);
        } catch (error) {
          this.logger.error(
            `Failed to download file for list ${list.name}:`,
            error,
          );
          throw new InternalServerErrorException(
            this.i18n.t(TranslationKeys.ERROR_LIST_FILE_DOWNLOAD_FAILED),
          );
        }

        const tempFileName = `temp-${list.id}-${Date.now()}.csv`;
        const tempFilePath = path.join(os.tmpdir(), tempFileName);

        this.logger.debug(`Writing temp file to: ${tempFilePath}`);
        await fs.writeFile(tempFilePath, csvContent, 'utf-8');

        let uploadResponse;
        try {
          uploadResponse = await this.fileManager.uploadFile(tempFilePath, {
            mimeType: 'text/csv',
            displayName: list.name,
          });
        } catch (error) {
          this.logger.error(
            `Failed to upload file for list ${list.name}:`,
            error,
          );
          throw new InternalServerErrorException(
            this.i18n.t(TranslationKeys.ERROR_LIST_FILE_UPLOAD_FAILED),
          );
        }

        const file = await this.waitForFileProcessing(
          uploadResponse.file.name as string,
          list.name,
        );

        await fs.unlink(tempFilePath).catch((err) => {
          this.logger.warn(`Failed to delete temp file ${tempFilePath}:`, err);
        });

        this.logger.debug(`Uploaded file to Gemini: ${list.name}`);

        return { uri: file.uri, name: file.name };
      } catch (error) {
        this.logger.error(
          `Failed to process file for list ${list.name}:`,
          error,
        );
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }

  private async waitForFileProcessing(fileName: string, listName: string) {
    const deadline = Date.now() + FILE_PROCESSING_TIMEOUT_MS;

    let file = await this.fileManager.getFile(fileName);

    while (file.state === FileState.PROCESSING) {
      if (Date.now() >= deadline) {
        throw new InternalServerErrorException(
          this.i18n.t(TranslationKeys.ERROR_LIST_FILE_UPLOAD_FAILED),
        );
      }
      await this.sleep(FILE_PROCESSING_POLL_INTERVAL_MS);
      file = await this.fileManager.getFile(fileName);
    }

    if (file.state === FileState.FAILED) {
      this.logger.error(`Gemini file processing failed for list: ${listName}`);
      throw new InternalServerErrorException(
        this.i18n.t(TranslationKeys.ERROR_LIST_FILE_UPLOAD_FAILED),
      );
    }

    return file;
  }

  private async cleanupGeminiFiles(
    uploadedFiles: UploadedFile[],
  ): Promise<void> {
    if (uploadedFiles.length === 0) return;

    await Promise.all(
      uploadedFiles.map(async (file) => {
        try {
          await this.fileManager.deleteFile(file.name);
          this.logger.debug(`Deleted Gemini file: ${file.name}`);
        } catch (error) {
          this.logger.warn(`Failed to delete Gemini file ${file.name}:`, error);
        }
      }),
    );
  }

  private buildSystemPromptWithFiles(
    listsCount: number,
    totalItems: number,
  ): string {
    const today = new Date().toISOString().split('T')[0];

    const listsContext =
      listsCount > 0
        ? LISTS_CONTEXT_WITH_FILES.replace(
            '{{LISTS_COUNT}}',
            listsCount.toString(),
          ).replace('{{TOTAL_ITEMS}}', totalItems.toString())
        : LISTS_CONTEXT_NO_FILES;

    return RECOMMENDATIONS_PROMPT.replace(
      '{{LISTS_CONTEXT}}',
      listsContext,
    ).replace('{{CURRENT_DATE}}', today);
  }

  private addFilesToHistory(
    conversationHistory: Array<{ role: string; parts: Array<any> }>,
    uploadedFiles: UploadedFile[],
  ): Array<{ role: string; parts: Array<any> }> {
    if (conversationHistory.length === 0 || uploadedFiles.length === 0) {
      return conversationHistory;
    }

    const lastIndex = conversationHistory.length - 1;
    const lastMessage = conversationHistory[lastIndex];

    if (lastMessage.role === messageAuthorToRole[MessageAuthor.USER]) {
      return [
        ...conversationHistory.slice(0, lastIndex),
        {
          ...lastMessage,
          parts: [
            ...uploadedFiles.map((file) => ({
              fileData: {
                mimeType: 'text/csv',
                fileUri: file.uri,
              },
            })),
            ...lastMessage.parts,
          ],
        },
      ];
    }

    return conversationHistory;
  }

  private buildConversationHistory(
    chatHistory: ChatMessage[],
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    return chatHistory.map((message) => {
      let messageText = message.text;

      if (
        message.author === MessageAuthor.ASSISTANT &&
        message.mediaItems &&
        message.mediaItems.length > 0
      ) {
        const recommendationsList = message.mediaItems
          .map((item) => `- ${item.title} (${item.type})`)
          .join('\n');

        messageText += `\n\nRecommended:\n${recommendationsList}`;
      }

      return {
        role: messageAuthorToRole[message.author],
        parts: [{ text: messageText }],
      };
    });
  }

  private parseResponse(fullText: string): AIRecommendationResponseDto {
    const separatorIndex = fullText.indexOf(JSON_SEPARATOR);

    if (separatorIndex === -1) {
      this.logger.warn(
        'Response does not contain expected separator, returning text-only response',
      );
      return { text: fullText.trim(), recommendations: [] };
    }

    const textResponse = fullText.slice(0, separatorIndex).trim();
    const jsonPart = fullText
      .slice(separatorIndex + JSON_SEPARATOR.length)
      .trim();

    try {
      const cleanJson = jsonPart
        .replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1')
        .trim();
      const parsed = JSON.parse(cleanJson) as unknown[];

      return {
        text: textResponse,
        recommendations: this.validateRecommendations(parsed),
      };
    } catch (error) {
      this.logger.error('Error parsing AI response JSON', error);
      throw new InternalServerErrorException(
        this.i18n.t(TranslationKeys.ERROR_AI_RESPONSE_PARSE_FAILED),
      );
    }
  }

  private validateRecommendations(
    recommendations: any[],
  ): AIRecommendationItemDto[] {
    if (!Array.isArray(recommendations)) {
      throw new Error('Recommendations is not an array');
    }

    return recommendations.map((rec, index) => {
      if (!rec.title || !rec.type) {
        throw new Error(
          `Invalid recommendation at index ${index}: missing required fields`,
        );
      }

      if (rec.type !== MediaType.MOVIE && rec.type !== MediaType.TV) {
        this.logger.warn(
          `Invalid media type "${rec.type}" at index ${index}, defaulting to movie`,
        );
        rec.type = MediaType.MOVIE;
      }

      return {
        title: rec.title,
        original_title: rec.original_title || rec.title,
        year: rec.year || null,
        type: rec.type as MediaType,
      };
    });
  }
}
