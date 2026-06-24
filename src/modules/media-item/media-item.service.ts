import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThan, Repository } from 'typeorm';

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

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async updateActiveMedia() {
    this.logger.log('Starting daily update of active media items');

    try {
      await this.updateActiveTVShows();
      await this.updateActiveMovies();

      this.logger.log('Completed daily update of active media items');
    } catch (error) {
      this.logger.error('Error in updateActiveMedia cron job:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOrphanedMediaItems() {
    this.logger.log('Starting cleanup of orphaned media items');

    try {
      const orphanedMediaItems = await this.mediaItemRepository
        .createQueryBuilder('mediaItem')
        .leftJoin('mediaItem.listMediaItems', 'listMediaItem')
        .where('listMediaItem.id IS NULL')
        .getMany();

      this.logger.log(
        `Found ${orphanedMediaItems.length} orphaned media items to delete`,
      );

      if (orphanedMediaItems.length > 0) {
        const orphanedIds = orphanedMediaItems.map((item) => item.id);

        await this.mediaItemRepository.delete(orphanedIds);

        this.logger.log(
          `Successfully deleted ${orphanedMediaItems.length} orphaned media items`,
        );
      }

      this.logger.log('Completed cleanup of orphaned media items');
    } catch (error) {
      this.logger.error('Error in cleanupOrphanedMediaItems cron job:', error);
    }
  }

  @Cron(CronExpression.EVERY_3_HOURS)
  async updateHotTVShows() {
    this.logger.log('Updating HOT TV shows');

    const BATCH_SIZE = 20;
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    while (hasMore) {
      const shows = await this.mediaItemRepository.find({
        where: {
          type: MediaType.TV,
          status: In(['Returning Series', 'In Production']),
          nextEpisodeAirDate: Between(yesterday, tomorrow),
        },
        take: BATCH_SIZE,
        skip: offset,
        order: { id: 'ASC' },
      });

      if (shows.length === 0) {
        hasMore = false;
        break;
      }

      const updatePromises = shows.map((tvShow) =>
        this.updateSingleShow(tvShow),
      );

      await Promise.all(updatePromises);

      totalProcessed += shows.length;
      offset += BATCH_SIZE;

      if (shows.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    this.logger.log(`Completed HOT update: ${totalProcessed}`);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async updatePlannedTVShows() {
    this.logger.log('Updating PLANNED TV shows');

    const BATCH_SIZE = 20;
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      const shows = await this.mediaItemRepository.find({
        where: {
          type: MediaType.TV,
          status: 'Planned',
        },
        take: BATCH_SIZE,
        skip: offset,
        order: { id: 'ASC' },
      });

      if (shows.length === 0) {
        hasMore = false;
        break;
      }

      const updatePromises = shows.map((tvShow) =>
        this.updateSingleShow(tvShow),
      );

      await Promise.all(updatePromises);

      totalProcessed += shows.length;
      offset += BATCH_SIZE;

      if (shows.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    this.logger.log(`Completed PLANNED update: ${totalProcessed}`);
  }

  private async updateActiveTVShows() {
    this.logger.log('Updating ACTIVE TV shows');

    const BATCH_SIZE = 20;
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    while (hasMore) {
      const shows = await this.mediaItemRepository.find({
        where: {
          type: MediaType.TV,
          status: In(['Returning Series', 'In Production']),
          nextEpisodeAirDate: MoreThan(tomorrow),
        },
        take: BATCH_SIZE,
        skip: offset,
        order: { id: 'ASC' },
      });

      if (shows.length === 0) {
        hasMore = false;
        break;
      }

      const updatePromises = shows.map((tvShow) =>
        this.updateSingleShow(tvShow),
      );

      await Promise.all(updatePromises);

      totalProcessed += shows.length;
      offset += BATCH_SIZE;

      if (shows.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    this.logger.log(`Completed ACTIVE update: ${totalProcessed}`);
  }

  private async updateSingleShow(tvShow: MediaItem) {
    try {
      if (!tvShow.tmdbId) {
        this.logger.warn(`TV show ${tvShow.id} has no TMDB ID, skipping`);
        return;
      }

      const details = await this.tmdbService.getTVShowDetails(tvShow.tmdbId);

      tvShow.status = details.status;
      tvShow.posterPath = details.posterPath;
      tvShow.numberOfEpisodes = details.numberOfEpisodes;
      tvShow.nextEpisodeAirDate = details.nextEpisodeToAir?.airDate
        ? new Date(details.nextEpisodeToAir.airDate)
        : null;
      tvShow.lastSyncAt = new Date();

      await this.mediaItemRepository.save(tvShow);

      this.logger.log(`Updated TV show ${tvShow.title} (ID: ${tvShow.id})`);
    } catch (error) {
      this.logger.error(
        `Error updating TV show ${tvShow.id} (${tvShow.title})`,
        error,
      );
    }
  }

  private async updateActiveMovies() {
    this.logger.log('Updating active movies');

    const BATCH_SIZE = 20;
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      const activeMovies = await this.mediaItemRepository.find({
        where: {
          type: MediaType.MOVIE,
          status: In([
            'Rumored',
            'Planned',
            'In Production',
            'Post Production',
          ]),
        },
        take: BATCH_SIZE,
        skip: offset,
        order: { id: 'ASC' },
      });

      if (activeMovies.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.log(
        `Processing batch: ${activeMovies.length} movies (offset: ${offset})`,
      );

      const updatePromises = activeMovies.map(async (movie) => {
        try {
          if (!movie.tmdbId) {
            this.logger.warn(`Movie ${movie.id} has no TMDB ID, skipping`);
            return;
          }

          const movieDetails = await this.tmdbService.movieDetails(
            movie.tmdbId,
          );

          movie.status = movieDetails.status;
          movie.lastSyncAt = new Date();

          await this.mediaItemRepository.save(movie);

          this.logger.log(
            `Updated movie ${movie.title} (ID: ${movie.id}) - Status: ${movie.status}`,
          );
        } catch (error) {
          this.logger.error(
            `Error updating movie ${movie.id} (${movie.title}):`,
            error,
          );
        }
      });

      await Promise.all(updatePromises);

      totalProcessed += activeMovies.length;
      offset += BATCH_SIZE;

      if (activeMovies.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    this.logger.log(`Completed updating ${totalProcessed} movies`);
  }

  async getOrCreate(row: IMDBRow) {
    let mediaItem = await this.mediaItemRepository.findOne({
      where: { imdbId: row.Const },
    });

    if (!mediaItem) {
      mediaItem = this.mediaItemRepository.create({
        imdbId: row.Const,
        title: row.Title,
        type: this.parseMediaType(row['Title Type']),
        genres: row.Genres ? row.Genres.split(',').map((g) => g.trim()) : [],
        year: row.Year ? parseInt(row.Year) : null,
        imdbRating: row['IMDb Rating'] ? parseFloat(row['IMDb Rating']) : null,
        runtime: row['Runtime (mins)'] ? parseInt(row['Runtime (mins)']) : null,
        lastSyncAt: new Date(),
      });

      const tmdbData = await this.tmdbService.findMediaByImdbId(row.Const);

      if (tmdbData) {
        mediaItem.type = tmdbData.type;
        mediaItem.tmdbId = tmdbData.data.id;
        mediaItem.posterPath = tmdbData.data.posterPath;
        if (mediaItem.type === MediaType.MOVIE) {
          try {
            const movieDetails = await this.tmdbService.movieDetails(
              tmdbData.data.id,
            );
            mediaItem.countries = movieDetails.productionCountries.map(
              (country) => country.iso31661,
            );
            mediaItem.companies = movieDetails.productionCompanies.map(
              (company) => company.name,
            );
            mediaItem.status = movieDetails.status;
          } catch (error) {
            this.logger.error(
              `Error getting movie details for ${row.Const}:`,
              error,
            );
          }
        }
        if (mediaItem.type === MediaType.TV) {
          try {
            const tvShowDetails = await this.tmdbService.getTVShowDetails(
              tmdbData.data.id,
            );
            mediaItem.countries = tvShowDetails.productionCountries.map(
              (country) => country.iso31661,
            );
            mediaItem.companies = tvShowDetails.productionCompanies.map(
              (company) => company.name,
            );
            mediaItem.status = tvShowDetails.status;
            mediaItem.numberOfEpisodes = tvShowDetails.numberOfEpisodes;
            mediaItem.nextEpisodeAirDate = tvShowDetails.nextEpisodeToAir
              ?.airDate
              ? new Date(tvShowDetails.nextEpisodeToAir.airDate)
              : null;
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

          const topActors = this.tmdbService.getTopActors(credits, 7);
          await this.mediaPersonService.saveAll(
            mediaItem.id,
            topActors,
            PersonRole.ACTOR,
          );
        }
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
}
