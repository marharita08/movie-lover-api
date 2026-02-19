import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MediaItem,
  MediaPerson,
  MediaType,
  Person,
  PersonRole,
} from 'src/entities';
import { List, ListStatus } from 'src/entities/list.entity';
import { ListMediaItem } from 'src/entities/list-media-item.entity';
import { ILike, Repository } from 'typeorm';

import { CsvParserService } from '../csv-parser/csv-parser.service';
import { FileService } from '../file/file.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { IMDBRow } from './dto';
import { CreateListDto, GetListsQueryDto, UpdateListDto } from './dto';

@Injectable()
export class ListService {
  private readonly logger = new Logger(ListService.name);

  constructor(
    @InjectRepository(List)
    private readonly listRepository: Repository<List>,
    @InjectRepository(ListMediaItem)
    private listMediaItemsRepository: Repository<ListMediaItem>,
    @InjectRepository(MediaItem)
    private mediaItemsRepository: Repository<MediaItem>,
    @InjectRepository(Person)
    private personsRepository: Repository<Person>,
    @InjectRepository(MediaPerson)
    private mediaPersonsRepository: Repository<MediaPerson>,
    private readonly fileService: FileService,
    private readonly tmdbService: TmdbService,
    private csvParserService: CsvParserService,
  ) {}

  async create(dto: CreateListDto, userId: string) {
    const file = await this.fileService.findOne(dto.fileId);

    if (!file || file.userId !== userId) {
      throw new ForbiddenException('File not found or access denied');
    }

    const list = this.listRepository.create({
      name: dto.name,
      fileId: dto.fileId,
      userId,
    });

    const savedList = await this.listRepository.save(list);
    await this.processList(savedList.id).catch((error) => {
      this.logger.error(`Failed to process list ${savedList.id}:`, error);
    });

    return savedList;
  }

  async findAll(
    query: GetListsQueryDto,
    userId: string,
  ): Promise<{
    results: List[];
    totalPages: number;
    page: number;
    totalResults: number;
  }> {
    const { name, page = 1, limit = 10 } = query;

    const where: any = { userId };
    if (name) {
      where.name = ILike(`%${name}%`);
    }

    const [data, total] = await this.listRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      results: data,
      totalPages: Math.ceil(total / limit),
      page,
      totalResults: total,
    };
  }

  async findOne(id: string, userId: string): Promise<List> {
    const list = await this.listRepository.findOne({
      where: { id, userId },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  async update(id: string, dto: UpdateListDto, userId: string): Promise<List> {
    const list = await this.findOne(id, userId);

    if (dto.fileId && dto.fileId !== list.fileId) {
      const file = await this.fileService.findOne(dto.fileId);
      if (!file || file.userId !== userId) {
        throw new ForbiddenException('File not found or access denied');
      }
    }

    Object.assign(list, dto);
    return this.listRepository.save(list);
  }

  async delete(id: string, userId: string): Promise<void> {
    const list = await this.findOne(id, userId);
    await this.fileService.delete(list.fileId);
    await this.listRepository.remove(list);
  }

  private async processList(listId: string): Promise<void> {
    try {
      const list = await this.listRepository.findOne({ where: { id: listId } });
      if (!list) return;

      const csvContent = await this.fileService.download(list.fileId);
      const rows = await this.csvParserService.parse<IMDBRow>(csvContent);

      list.totalItems = rows.length;
      await this.listRepository.save(list);

      const BATCH_SIZE = 10;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((row, index) =>
            this.processMediaItem(list.id, row, i + index),
          ),
        );

        this.logger.log(
          `Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} items`,
        );
      }

      list.status = ListStatus.COMPLETED;
      await this.listRepository.save(list);

      this.logger.log(`List ${listId} processing completed`);
    } catch (error) {
      this.logger.error(`Error processing list ${listId}:`, error);

      await this.listRepository.update(listId, {
        status: ListStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }

  private async processMediaItem(
    listId: string,
    row: IMDBRow,
    position: number,
  ): Promise<void> {
    try {
      let mediaItem = await this.mediaItemsRepository.findOne({
        where: { imdbId: row.Const },
      });

      if (!mediaItem) {
        const mediaType = this.parseMediaType(row['Title Type']);

        mediaItem = this.mediaItemsRepository.create({
          imdbId: row.Const,
          title: row.Title,
          type: mediaType,
          genres: row.Genres ? row.Genres.split(',').map((g) => g.trim()) : [],
          year: row.Year ? parseInt(row.Year) : null,
          imdbRating: row['IMDb Rating']
            ? parseFloat(row['IMDb Rating'])
            : null,
          runtime: row['Runtime (mins)']
            ? parseInt(row['Runtime (mins)'])
            : null,
        });

        const tmdbData = await this.tmdbService.findMediaByImdbId(row.Const);

        if (tmdbData) {
          mediaItem.tmdbId = tmdbData.data.id;
          mediaItem.posterPath = tmdbData.data.posterPath;
          mediaItem.status = tmdbData.data.status;
          if (
            mediaItem.type === MediaType.TV &&
            'numberOfSeasons' in tmdbData.data
          ) {
            mediaItem.numberOfSeasons = tmdbData.data.numberOfSeasons;
            mediaItem.numberOfEpisodes = tmdbData.data.numberOfEpisodes;
          }

          await this.mediaItemsRepository.save(mediaItem);

          const credits =
            tmdbData.type === MediaType.MOVIE
              ? await this.tmdbService.getMovieCredits(tmdbData.data.id)
              : await this.tmdbService.getTVShowCredits(tmdbData.data.id);

          if (credits) {
            const directors = this.tmdbService.getDirectors(credits);
            await this.saveMediaPersons(
              mediaItem.id,
              directors,
              PersonRole.DIRECTOR,
            );

            const topActors = this.tmdbService.getTopActors(credits, 5);
            await this.saveMediaPersons(
              mediaItem.id,
              topActors,
              PersonRole.ACTOR,
            );
          }

          await this.sleep(25);
        } else {
          await this.mediaItemsRepository.save(mediaItem);
        }
      } else {
        this.logger.log(`Media item ${row.Const} already exists, reusing`);
      }

      const listMediaItem = this.listMediaItemsRepository.create({
        listId,
        mediaItemId: mediaItem.id,
        userRating: row['Your Rating'] ? parseInt(row['Your Rating']) : null,
        dateRated: row['Date Rated'] ? new Date(row['Date Rated']) : null,
        position,
      });

      await this.listMediaItemsRepository.save(listMediaItem);
    } catch (error) {
      this.logger.error(`Error processing media item ${row.Const}:`, error);
    }
  }

  private parseMediaType(titleType?: string): MediaType {
    const type = titleType?.toLowerCase();

    if (type?.includes('tv') || type?.includes('series')) {
      return MediaType.TV;
    }

    return MediaType.MOVIE;
  }

  private async saveMediaPersons(
    mediaItemId: string,
    persons: Array<{ id: number; name: string; profilePath?: string | null }>,
    role: PersonRole,
  ): Promise<void> {
    for (const personData of persons) {
      try {
        const personInfo = await this.tmdbService.getPerson(personData.id);

        await this.personsRepository
          .createQueryBuilder()
          .insert()
          .into(Person)
          .values({
            tmdbId: personData.id,
            name: personData.name,
            profilePath: personData.profilePath,
            imdbId: personInfo?.imdbId || null,
          })
          .orIgnore()
          .execute();

        const person = await this.personsRepository.findOne({
          where: { tmdbId: personData.id },
        });

        if (!person) {
          throw new Error(`Person ${personData.id} not found`);
        }

        const existingRelation = await this.mediaPersonsRepository.findOne({
          where: {
            mediaItemId,
            personId: person.id,
            role,
          },
        });

        if (!existingRelation) {
          const mediaPerson = this.mediaPersonsRepository.create({
            mediaItemId,
            personId: person.id,
            role,
          });

          await this.mediaPersonsRepository.save(mediaPerson);
        }
      } catch (error) {
        this.logger.error(`Error saving person ${personData.id}:`, error);
      }
    }
  }

  async getGenreAnalytics(listId: string) {
    const list = await this.listRepository.findOne({
      where: { id: listId },
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (list.status !== ListStatus.COMPLETED) {
      return {
        listId,
        status: list.status,
        message: 'List is still processing',
      };
    }

    const result: { genre: string; count: string }[] =
      await this.listMediaItemsRepository
        .createQueryBuilder('lmi')
        .innerJoin('lmi.mediaItem', 'media')
        .select('unnest(media.genres)', 'genre')
        .addSelect('COUNT(*)', 'count')
        .where('lmi.listId = :listId', { listId })
        .groupBy('genre')
        .orderBy('count', 'DESC')
        .getRawMany();

    const genreStats = result.reduce(
      (acc, { genre, count }) => {
        acc[genre] = parseInt(count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return genreStats;
  }

  async getPersonsAnalytics(
    listId: string,
    role: PersonRole,
    limit: number = 10,
  ) {
    const list = await this.listRepository.findOne({
      where: { id: listId },
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (list.status !== ListStatus.COMPLETED) {
      return {
        listId,
        status: list.status,
        message: 'List is still processing',
      };
    }

    const result: {
      personId: string;
      imdbId: string;
      name: string;
      profilePath: string;
      itemCount: string;
      titles: string[];
    }[] = await this.mediaPersonsRepository
      .createQueryBuilder('mp')
      .innerJoin('mp.person', 'person')
      .innerJoin('mp.mediaItem', 'media')
      .innerJoin('media.listMediaItems', 'lmi')
      .select('person.id', 'personId')
      .addSelect('person.name', 'name')
      .addSelect('person.profilePath', 'profilePath')
      .addSelect('person.imdbId', 'imdbId')
      .addSelect('COUNT(DISTINCT media.id)', 'itemCount')
      .addSelect('ARRAY_AGG(DISTINCT media.title)', 'titles')
      .where('lmi.listId = :listId', { listId })
      .andWhere('mp.role = :role', { role })
      .groupBy('person.id')
      .addGroupBy('person.name')
      .addGroupBy('person.profilePath')
      .orderBy('COUNT(DISTINCT media.id)', 'DESC')
      .addOrderBy('person.name', 'ASC')
      .limit(limit)
      .getRawMany();

    return {
      role,
      persons: result.map((row) => ({
        id: row.personId,
        imdbId: row.imdbId,
        name: row.name,
        profilePath: row.profilePath,
        itemCount: parseInt(row.itemCount),
        titles: Array.isArray(row.titles) ? row.titles.join(', ') : row.titles,
      })),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
