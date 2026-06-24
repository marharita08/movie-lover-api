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

const FILE_PROCESSING_TIMEOUT_MS = 60000;
const FILE_PROCESSING_POLL_INTERVAL_MS = 1000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private model;

  constructor(
    private storageService: StorageService,
    private readonly i18n: TranslationService,
    @Inject(geminiConfig.KEY)
    private readonly config: ConfigType<typeof geminiConfig>,
  ) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.fileManager = new GoogleAIFileManager(config.apiKey);

    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
      tools: [{ google_search: {} } as any],
    });
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

      this.logger.debug(
        `Sending request to Gemini API with ${uploadedFiles.length} CSV files`,
      );

      const fullText = await this.generateContent(
        contentsWithFiles,
        systemPrompt,
      );

      this.logger.debug(`Received response from Gemini API`);

      return this.parseResponse(fullText);
    } finally {
      await this.cleanupGeminiFiles(uploadedFiles);
    }
  }

  private async generateContent(
    contents: Array<{ role: string; parts: Array<any> }>,
    systemInstruction: string,
  ): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents,
        systemInstruction,
      });

      return result.response.text() as string;
    } catch (error) {
      throw this.mapGeminiError(error);
    }
  }

  private mapGeminiError(error: unknown): HttpException {
    if (error instanceof GoogleGenerativeAIFetchError) {
      const status = error.status;

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        this.logger.warn('Gemini API rate limit exceeded');
        return new HttpException(
          this.i18n.t(TranslationKeys.ERROR_AI_RATE_LIMIT),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status === HttpStatus.BAD_REQUEST) {
        const isSafetyBlock = error.message?.toLowerCase().includes('safety');
        if (isSafetyBlock) {
          this.logger.warn('Gemini API request blocked by safety filters');
          return new BadRequestException(
            this.i18n.t(TranslationKeys.ERROR_AI_SAFETY_BLOCK),
          );
        }
        this.logger.error('Gemini API bad request', error.message);
        return new InternalServerErrorException(
          this.i18n.t(TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE),
        );
      }

      if (
        status === HttpStatus.UNAUTHORIZED ||
        status === HttpStatus.FORBIDDEN
      ) {
        this.logger.error(
          `Gemini API auth error (${status}) — check GEMINI_API_KEY configuration`,
        );
        return new InternalServerErrorException(
          this.i18n.t(TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE),
        );
      }

      if (
        status === HttpStatus.INTERNAL_SERVER_ERROR ||
        status === HttpStatus.SERVICE_UNAVAILABLE
      ) {
        this.logger.error(`Gemini API server error (${status})`);
        return new ServiceUnavailableException(
          this.i18n.t(TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE),
        );
      }

      this.logger.error(
        `Unhandled Gemini API error (${status})`,
        error.message,
      );
      return new InternalServerErrorException(
        this.i18n.t(TranslationKeys.ERROR_AI_UNEXPECTED_ERROR),
      );
    }

    this.logger.error('Unexpected error calling Gemini API', error);
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
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, tempFileName);

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

        return {
          uri: file.uri,
          name: file.name,
        };
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

      await new Promise((resolve) =>
        setTimeout(resolve, FILE_PROCESSING_POLL_INTERVAL_MS),
      );

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

  private parseResponse(fullText: string): AIRecommendationResponseDto {
    const separatorIndex = fullText.indexOf(JSON_SEPARATOR);

    if (separatorIndex === -1) {
      this.logger.warn(
        'Response does not contain expected separator, returning text-only response',
      );
      return {
        text: fullText.trim(),
        recommendations: [],
      };
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
