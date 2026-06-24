import { Injectable, Logger } from '@nestjs/common';

import { Language, MediaItemRecommendation, MediaType } from 'src/entities';

import { AIRecommendationItemDto } from '../ai/dto/ai-recommendation-item.dto';
import { TmdbService } from '../tmdb/tmdb.service';

@Injectable()
export class MediaSearchService {
  private readonly logger = new Logger(MediaSearchService.name);

  constructor(private readonly tmdbService: TmdbService) {}

  async resolveMediaItem(
    recommendation: AIRecommendationItemDto,
    language: Language,
  ): Promise<MediaItemRecommendation> {
    const { title, original_title, year, type } = recommendation;

    if (type === MediaType.MOVIE) {
      return this.resolveMovie(title, original_title, year, language);
    }

    if (type === MediaType.TV) {
      return this.resolveTvShow(title, original_title, year, language);
    }

    throw new Error(`Unknown media type`);
  }

  private async resolveMovie(
    title: string,
    originalTitle: string | null,
    year: number | null,
    language: Language,
  ): Promise<MediaItemRecommendation> {
    const searches = this.buildSearchSequence(title, originalTitle, year);

    for (const { query, includeYear } of searches) {
      const result = await this.searchMovie(
        query,
        includeYear ? year : null,
        year,
        language,
      );
      if (result) return result;
    }

    throw new Error(`Movie not found: ${title} (${year})`);
  }

  private async resolveTvShow(
    title: string,
    originalTitle: string | null,
    year: number | null,
    language: Language,
  ): Promise<MediaItemRecommendation> {
    const searches = this.buildSearchSequence(title, originalTitle, year);

    for (const { query, includeYear } of searches) {
      const result = await this.searchTvShow(
        query,
        includeYear ? year : null,
        year,
        language,
      );
      if (result) return result;
    }

    throw new Error(`TV show not found: ${title} (${year})`);
  }

  private buildSearchSequence(
    title: string,
    originalTitle: string | null,
    year: number | null,
  ): Array<{ query: string; includeYear: boolean }> {
    const sequence: Array<{ query: string; includeYear: boolean }> = [];

    if (originalTitle && year) {
      sequence.push({ query: originalTitle, includeYear: true });
    }

    if (year) {
      sequence.push({ query: title, includeYear: true });
    }

    if (originalTitle) {
      sequence.push({ query: originalTitle, includeYear: false });
    }

    sequence.push({ query: title, includeYear: false });

    return sequence;
  }

  private async searchMovie(
    query: string,
    year: number | null,
    originalYear: number | null,
    language: Language,
  ): Promise<MediaItemRecommendation | null> {
    try {
      const movies = await this.tmdbService.searchMovies({
        query,
        year: year ?? undefined,
        language,
      });

      if (!movies.results?.length) return null;

      const match = year
        ? movies.results.find((m) =>
            this.isYearMatch(m.releaseDate, originalYear),
          )
        : (movies.results.find((m) =>
            this.isYearMatch(m.releaseDate, originalYear),
          ) ?? movies.results[0]);

      if (!match) return null;

      return {
        type: MediaType.MOVIE,
        id: match.id,
        title: match.title,
        posterPath: match.posterPath,
      };
    } catch (error) {
      this.logger.warn(`Movie search failed for query "${query}":`, error);
      return null;
    }
  }

  private async searchTvShow(
    query: string,
    year: number | null,
    originalYear: number | null,
    language: Language,
  ): Promise<MediaItemRecommendation | null> {
    try {
      const tvShows = await this.tmdbService.searchTVShows({
        query,
        year: year ?? undefined,
        language,
      });

      if (!tvShows.results?.length) return null;

      const match = year
        ? tvShows.results.find((s) =>
            this.isYearMatch(s.firstAirDate, originalYear),
          )
        : (tvShows.results.find((s) =>
            this.isYearMatch(s.firstAirDate, originalYear),
          ) ?? tvShows.results[0]);

      if (!match) return null;

      return {
        type: MediaType.TV,
        id: match.id,
        title: match.name,
        posterPath: match.posterPath || null,
      };
    } catch (error) {
      this.logger.warn(`TV show search failed for query "${query}":`, error);
      return null;
    }
  }

  private isYearMatch(
    dateString: string | null | undefined,
    year: number | null,
  ): boolean {
    if (!dateString || !year) return false;
    const itemYear = new Date(dateString).getFullYear();
    return Math.abs(itemYear - year) <= 3;
  }
}
