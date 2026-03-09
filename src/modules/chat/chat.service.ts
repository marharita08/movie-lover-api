import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ChatMessage,
  ListStatus,
  MediaItemRecommendation,
  MediaType,
  MessageAuthor,
} from 'src/entities';
import { PaginatedResponseDto } from 'src/modules/tmdb/dto';

import { AiService } from '../ai/ai.service';
import { ListService } from '../list/list.service';
import { TmdbService } from '../tmdb/tmdb.service';

import { WELCOME_MESSAGE } from './const';
import { ChatHistoryQueryDto } from './dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly listService: ListService,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly tmdbService: TmdbService,
  ) {}

  async processUserMessage(userId: string, message: string) {
    const userLists = await this.listService.findAll(
      { status: ListStatus.COMPLETED, page: 1, limit: 10 },
      userId,
    );

    const userChatMessage = this.chatMessageRepository.create({
      userId,
      text: message,
      author: MessageAuthor.USER,
      mediaItems: null,
    });
    await this.chatMessageRepository.save(userChatMessage);

    const chatHistory = await this.getChatHistory(userId, {
      page: 1,
      limit: 11,
    });

    const aiResponse = await this.aiService.getRecommendations(
      userLists.results,
      chatHistory.results.reverse(),
    );

    const mediaItemsResults = await Promise.allSettled(
      aiResponse.recommendations.map(async (recommendation) => {
        try {
          if (recommendation.type === MediaType.MOVIE) {
            const movies = await this.tmdbService.searchMovies({
              query: recommendation.title,
              year: recommendation.year,
            });

            if (!movies.results || movies.results.length === 0) {
              throw new Error(`Movie not found: ${recommendation.title}`);
            }

            const movie = movies.results[0];
            return {
              type: MediaType.MOVIE,
              id: movie.id,
              title: movie.title,
              posterPath: movie.posterPath || null,
            };
          }

          if (recommendation.type === MediaType.TV) {
            const tvShows = await this.tmdbService.searchTVShows({
              query: recommendation.title,
              year: recommendation.year,
            });

            if (!tvShows.results || tvShows.results.length === 0) {
              throw new Error(`TV show not found: ${recommendation.title}`);
            }

            const tvShow = tvShows.results[0];
            return {
              type: MediaType.TV,
              id: tvShow.id,
              title: tvShow.name,
              posterPath: tvShow.posterPath || null,
            };
          }

          throw new Error('Unknown media type');
        } catch (error) {
          this.logger.error(
            `Failed to fetch media item: ${recommendation.title} (${recommendation.year}) - ${recommendation.type}`,
            error,
          );
          throw error;
        }
      }),
    );

    const successfulMediaItems: MediaItemRecommendation[] = mediaItemsResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    const failedResults = mediaItemsResults.filter(
      (result) => result.status === 'rejected',
    );

    if (failedResults.length > 0) {
      this.logger.warn(
        `Failed to fetch ${failedResults.length} out of ${mediaItemsResults.length} recommendations`,
      );
    }

    const isAnySuccess = successfulMediaItems.length > 0;
    const aiChatMessage = this.chatMessageRepository.create({
      userId,
      text: isAnySuccess
        ? aiResponse.text
        : 'An error occurred while generating recommendations. Please try again.',
      author: MessageAuthor.ASSISTANT,
      mediaItems: isAnySuccess ? successfulMediaItems : null,
      isError: !isAnySuccess,
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
      const welcomeMessage = this.chatMessageRepository.create({
        userId,
        text: WELCOME_MESSAGE,
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
