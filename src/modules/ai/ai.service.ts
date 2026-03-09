import { GoogleGenerativeAI } from '@google/generative-ai';
import { FileState, GoogleAIFileManager } from '@google/generative-ai/server';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { ChatMessage, List, MediaType, MessageAuthor } from 'src/entities';

import { StorageService } from '../storage/storage.service';

import { AIRecommendationResponseDto } from './dto/ai-recommendation-response.dto';
import {
  LISTS_CONTEXT_NO_FILES,
  LISTS_CONTEXT_WITH_FILES,
  RECOMMENDATIONS_PROMPT,
} from './prompts/recommendations.prompt';

interface UploadedFile {
  uri: string;
  name: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private model;

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY is not configured',
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);

    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
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

      const result = await this.model.generateContent({
        contents: contentsWithFiles,
        systemInstruction: systemPrompt,
      });

      const response = await result.response;
      const fullText = response.text();

      this.logger.debug(`Received response from Gemini API`);

      return this.parseResponse(fullText as string);
    } catch (error) {
      this.logger.error('Error getting recommendations from Gemini', error);
      throw error;
    } finally {
      await this.cleanupGeminiFiles(uploadedFiles);
    }
  }

  private async uploadListFiles(userLists: List[]): Promise<UploadedFile[]> {
    const uploadPromises = userLists.map(async (list) => {
      try {
        const csvContent = await this.storageService.downloadFile(
          list.file.key,
        );

        const tempFileName = `temp-${list.id}-${Date.now()}.csv`;
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, tempFileName);

        this.logger.debug(`Writing temp file to: ${tempFilePath}`);

        await fs.writeFile(tempFilePath, csvContent, 'utf-8');

        const uploadResponse = await this.fileManager.uploadFile(tempFilePath, {
          mimeType: 'text/csv',
          displayName: list.name,
        });

        let file = await this.fileManager.getFile(uploadResponse.file.name);
        while (file.state === FileState.PROCESSING) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          file = await this.fileManager.getFile(uploadResponse.file.name);
        }

        if (file.state === FileState.FAILED) {
          throw new Error(`File processing failed: ${list.name}`);
        }

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
          `Failed to upload file for list ${list.name}:`,
          error,
        );
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }
  private buildSystemPromptWithFiles(
    listsCount: number,
    totalItems: number,
  ): string {
    const listsContext =
      listsCount > 0
        ? LISTS_CONTEXT_WITH_FILES.replace(
            '{{LISTS_COUNT}}',
            listsCount.toString(),
          ).replace('{{TOTAL_ITEMS}}', totalItems.toString())
        : LISTS_CONTEXT_NO_FILES;

    return RECOMMENDATIONS_PROMPT.replace('{{LISTS_CONTEXT}}', listsContext);
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

    if (lastMessage.role === 'user') {
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
          .map(
            (item) =>
              `- ${item.title} (${item.type === MediaType.MOVIE ? 'movie' : 'TV show'})`,
          )
          .join('\n');

        messageText += `\n\nRecommended:\n${recommendationsList}`;
      }

      return {
        role: message.author === MessageAuthor.USER ? 'user' : 'model',
        parts: [{ text: messageText }],
      };
    });
  }

  private async cleanupGeminiFiles(
    uploadedFiles: UploadedFile[],
  ): Promise<void> {
    if (uploadedFiles.length === 0) return;

    try {
      await Promise.all(
        uploadedFiles.map(async (file) => {
          try {
            await this.fileManager.deleteFile(file.name);
            this.logger.debug(`Deleted Gemini file: ${file.name}`);
          } catch (error) {
            this.logger.warn(
              `Failed to delete Gemini file ${file.name}:`,
              error,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.warn('Error during Gemini files cleanup:', error);
    }
  }

  private parseResponse(fullText: string): AIRecommendationResponseDto {
    try {
      const parts = fullText.split('---JSON---');

      if (parts.length !== 2) {
        this.logger.warn(
          'Response does not contain expected separator, attempting fallback parsing',
        );
        return this.fallbackParse(fullText);
      }

      const textResponse = parts[0].trim();
      const jsonPart = parts[1].trim();

      const jsonMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
        null,
        jsonPart,
      ];
      const cleanJson = jsonMatch[1].trim();

      const recommendations = JSON.parse(cleanJson);

      if (!Array.isArray(recommendations)) {
        throw new InternalServerErrorException(
          'Recommendations is not an array',
        );
      }

      const validatedRecommendations = recommendations.map((rec, index) => {
        if (!rec.title || !rec.type) {
          throw new InternalServerErrorException(
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
          year: rec.year || null,
          type: rec.type as MediaType,
        };
      });

      return {
        text: textResponse,
        recommendations: validatedRecommendations,
      };
    } catch (error) {
      this.logger.error('Error parsing AI response', error);
      throw new InternalServerErrorException(
        'Failed to parse AI response. Please try again.',
      );
    }
  }

  private fallbackParse(fullText: string): AIRecommendationResponseDto {
    const jsonMatch = fullText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new InternalServerErrorException(
        'Could not find valid JSON in response',
      );
    }

    const recommendations = JSON.parse(jsonMatch[0]);
    const textResponse = fullText.substring(0, jsonMatch.index).trim();

    return {
      text: textResponse || 'Here are my recommendations:',
      recommendations: recommendations.map((rec) => ({
        title: rec.title,
        year: rec.year || null,
        type: (rec.type as MediaType) || MediaType.MOVIE,
      })),
    };
  }
}
