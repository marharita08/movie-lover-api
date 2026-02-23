import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MediaItem, MediaType, PersonRole } from 'src/entities';
import { MediaPersonService } from 'src/modules/media-person/media-person.service';
import { TmdbService } from 'src/modules/tmdb/tmdb.service';

import { IMDBRow } from '../list/dto';

@Injectable()
export class MediaItemService {
  private readonly logger = new Logger(MediaItemService.name);

  constructor(
    @InjectRepository(MediaItem)
    private readonly mediaItemRepository: Repository<MediaItem>,
    private readonly tmdbService: TmdbService,
    private readonly mediaPersonService: MediaPersonService,
  ) {}

  async getOrCreate(row: IMDBRow) {
    let mediaItem = await this.mediaItemRepository.findOne({
      where: { imdbId: row.Const },
    });

    if (!mediaItem) {
      const mediaType = this.parseMediaType(row['Title Type']);

      mediaItem = this.mediaItemRepository.create({
        imdbId: row.Const,
        title: row.Title,
        type: mediaType,
        genres: row.Genres ? row.Genres.split(',').map((g) => g.trim()) : [],
        year: row.Year ? parseInt(row.Year) : null,
        imdbRating: row['IMDb Rating'] ? parseFloat(row['IMDb Rating']) : null,
        runtime: row['Runtime (mins)'] ? parseInt(row['Runtime (mins)']) : null,
      });

      const tmdbData = await this.tmdbService.findMediaByImdbId(row.Const);

      if (tmdbData) {
        mediaItem.tmdbId = tmdbData.data.id;
        mediaItem.posterPath = tmdbData.data.posterPath;
        mediaItem.status = tmdbData.data.status;
        if (mediaItem.type === MediaType.TV) {
          try {
            const tvShowDetails = await this.tmdbService.getTVShowDetails(
              tmdbData.data.id,
            );
            mediaItem.numberOfSeasons = tvShowDetails.numberOfSeasons;
            mediaItem.numberOfEpisodes = tvShowDetails.numberOfEpisodes;
          } catch (error) {
            this.logger.error(
              `Error getting TV show details for ${row.Const}:`,
              error,
            );
          }
        }

        await this.mediaItemRepository.save(mediaItem);

        const credits =
          tmdbData.type === MediaType.MOVIE
            ? await this.tmdbService.getMovieCredits(tmdbData.data.id)
            : await this.tmdbService.getTVShowCredits(tmdbData.data.id);

        if (credits) {
          const directors = this.tmdbService.getDirectors(credits);
          await this.mediaPersonService.saveAll(
            mediaItem.id,
            directors,
            PersonRole.DIRECTOR,
          );

          const topActors = this.tmdbService.getTopActors(credits, 5);
          await this.mediaPersonService.saveAll(
            mediaItem.id,
            topActors,
            PersonRole.ACTOR,
          );
        }

        await this.sleep(25);
      } else {
        await this.mediaItemRepository.save(mediaItem);
      }
    } else {
      this.logger.log(`Media item ${row.Const} already exists, reusing`);
    }

    return mediaItem;
  }

  private parseMediaType(titleType?: string): MediaType {
    const type = titleType?.toLowerCase();

    if (type?.includes('tv') || type?.includes('series')) {
      return MediaType.TV;
    }

    return MediaType.MOVIE;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
