import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TranslationKeys } from 'src/const/translations/keys';
import {
  ChatMessage,
  ListStatus,
  MediaItemRecommendation,
  MessageAuthor,
} from 'src/entities';
import { PaginatedResponseDto } from 'src/modules/tmdb/dto';
import { TranslationService } from 'src/modules/translation/translation.service';

import { AiService } from '../ai/ai.service';
import { ListService } from '../list/list.service';
import { UserDto } from '../user/dto';

import { ChatHistoryQueryDto } from './dto';
import { MediaSearchService } from './media-search.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly listService: ListService,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly mediaSearchService: MediaSearchService,
    private readonly i18n: TranslationService,
  ) {}

  async processUserMessage(user: UserDto, message: string) {
    const userLists = await this.listService.findAll(
      { status: ListStatus.COMPLETED, page: 1, limit: 10 },
      user.id,
    );

    const userChatMessage = this.chatMessageRepository.create({
      userId: user.id,
      text: message,
      author: MessageAuthor.USER,
      mediaItems: null,
    });
    await this.chatMessageRepository.save(userChatMessage);

    const chatHistory = await this.getChatHistory(user.id, {
      page: 1,
      limit: 10,
    });

    const aiResponse = await this.aiService.getRecommendations(
      userLists.results,
      chatHistory.results.reverse(),
    );

    if (aiResponse.recommendations.length === 0) {
      const aiChatMessage = this.chatMessageRepository.create({
        userId: user.id,
        text: aiResponse.text,
        author: MessageAuthor.ASSISTANT,
        mediaItems: null,
        isError: false,
      });
      return await this.chatMessageRepository.save(aiChatMessage);
    }

    const mediaItemsResults = await Promise.allSettled(
      aiResponse.recommendations.map((recommendation) =>
        this.mediaSearchService.resolveMediaItem(recommendation, user.language),
      ),
    );

    const successfulMediaItems: MediaItemRecommendation[] = mediaItemsResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    const failedCount = mediaItemsResults.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failedCount > 0) {
      this.logger.warn(
        `Failed to fetch ${failedCount} out of ${mediaItemsResults.length} recommendations`,
      );
    }

    const hasSuccessfulItems = successfulMediaItems.length > 0;
    const aiChatMessage = this.chatMessageRepository.create({
      userId: user.id,
      text: hasSuccessfulItems
        ? aiResponse.text
        : this.i18n.t(TranslationKeys.ERROR_RECOMMENDATIONS_FAILED),
      author: MessageAuthor.ASSISTANT,
      mediaItems: hasSuccessfulItems ? successfulMediaItems : null,
      isError: !hasSuccessfulItems,
    });

    return await this.chatMessageRepository.save(aiChatMessage);
  }

  async getChatHistory(
    userId: string,
    query: ChatHistoryQueryDto,
  ): Promise<PaginatedResponseDto<ChatMessage>> {
    const { page = 1, limit = 20 } = query;

    const totalResults = await this.chatMessageRepository.count({
      where: { userId },
    });

    if (totalResults === 0) {
      const welcomeMessageText: string = this.i18n.t(
        TranslationKeys.CHAT_WELCOME_MESSAGE,
      );
      const welcomeMessage = this.chatMessageRepository.create({
        userId,
        text: welcomeMessageText,
        author: MessageAuthor.ASSISTANT,
        mediaItems: null,
      });
      await this.chatMessageRepository.save(welcomeMessage);

      return {
        page: 1,
        results: [welcomeMessage],
        totalPages: 1,
        totalResults: 1,
      };
    }

    const skip = (page - 1) * limit;

    const results = await this.chatMessageRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalResults / limit);

    return {
      page,
      results,
      totalPages,
      totalResults,
    };
  }

  async clearChatHistory(userId: string) {
    return this.chatMessageRepository.delete({ userId });
  }
}
