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
      mediaItem = this.mediaItemRepository.create({
        imdbId: row.Const,
        title: row.Title,
        type: this.parseMediaType(row['Title Type']),
        genres: row.Genres ? row.Genres.split(',').map((g) => g.trim()) : [],
        year: row.Year ? parseInt(row.Year) : null,
        imdbRating: row['IMDb Rating'] ? parseFloat(row['IMDb Rating']) : null,
        runtime: row['Runtime (mins)'] ? parseInt(row['Runtime (mins)']) : null,
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
