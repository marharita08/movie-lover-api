import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import {
  List,
  ListMediaItem,
  ListStatus,
  MediaPerson,
  MediaType,
} from 'src/entities';
import { CsvParserService } from 'src/modules/csv-parser/csv-parser.service';
import { FileService } from 'src/modules/file/file.service';
import { ListMediaItemService } from 'src/modules/list-media-item/list-media-item.service';

import {
  CreateListDto,
  GetListsQueryDto,
  GetMediaItemsQueryDto,
  GetPersonStatsQuery,
  GetRatingStatsQueryDto,
  IMDBRow,
} from './dto';

@Injectable()
export class ListService {
  private readonly logger = new Logger(ListService.name);

  constructor(
    @InjectRepository(List)
    private readonly listRepository: Repository<List>,
    @InjectRepository(ListMediaItem)
    private listMediaItemsRepository: Repository<ListMediaItem>,
    @InjectRepository(MediaPerson)
    private mediaPersonsRepository: Repository<MediaPerson>,
    private readonly fileService: FileService,
    private readonly csvParserService: CsvParserService,
    private readonly listMediaItemService: ListMediaItemService,
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
    await this.processList(savedList.id);
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
      throw new NotFoundException(`List with ID ${id} not found`);
    }

    return list;
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
      const rows = await this.csvParserService.parseAndValidate(
        csvContent,
        IMDBRow,
      );

      list.totalItems = rows.length;
      await this.listRepository.save(list);

      const BATCH_SIZE = 10;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((row, index) =>
            this.listMediaItemService.add(list.id, row, i + index),
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

  async getGenreAnalytics(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

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
    userId: string,
    query: GetPersonStatsQuery,
  ) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const { role, page = 1, limit = 10 } = query;

    const totalCount: { count: string } | undefined =
      await this.mediaPersonsRepository
        .createQueryBuilder('mp')
        .innerJoin('mp.person', 'person')
        .innerJoin('mp.mediaItem', 'media')
        .innerJoin('media.listMediaItems', 'lmi')
        .select('COUNT(DISTINCT person.id)', 'count')
        .where('lmi.listId = :listId', { listId })
        .andWhere('mp.role = :role', { role })
        .getRawOne();

    const total = totalCount ? parseInt(totalCount.count) : 0;

    const result: {
      id: string;
      name: string;
      profilePath: string;
      itemCount: string;
      titles: string[];
    }[] = await this.mediaPersonsRepository
      .createQueryBuilder('mp')
      .innerJoin('mp.person', 'person')
      .innerJoin('mp.mediaItem', 'media')
      .innerJoin('media.listMediaItems', 'lmi')
      .select('person.tmdbId', 'id')
      .addSelect('person.name', 'name')
      .addSelect('person.profilePath', 'profilePath')
      .addSelect('COUNT(DISTINCT media.id)', 'itemCount')
      .addSelect('ARRAY_AGG(DISTINCT media.title)', 'titles')
      .where('lmi.listId = :listId', { listId })
      .andWhere('mp.role = :role', { role })
      .groupBy('person.tmdbId')
      .addGroupBy('person.name')
      .addGroupBy('person.profilePath')
      .orderBy('COUNT(DISTINCT media.id)', 'DESC')
      .addOrderBy('person.name', 'ASC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany();

    return {
      results: result.map((row) => ({
        id: row.id,
        name: row.name,
        profilePath: row.profilePath,
        itemCount: parseInt(row.itemCount),
        titles: Array.isArray(row.titles) ? row.titles.join(', ') : row.titles,
      })),
      totalPages: Math.ceil(total / limit),
      page,
      totalResults: total,
    };
  }

  async getMediaItems(
    id: string,
    userId: string,
    query: GetMediaItemsQueryDto,
  ) {
    const list = await this.findOne(id, userId);
    this.checkListStatus(list);

    const { page = 1, limit = 10 } = query;

    const totalCount: { count: string } | undefined =
      await this.listMediaItemsRepository
        .createQueryBuilder('lmi')
        .innerJoin('lmi.mediaItem', 'media')
        .select('COUNT(DISTINCT media.id)', 'count')
        .where('lmi.listId = :listId', { listId: id })
        .getRawOne();

    const total = totalCount ? parseInt(totalCount.count) : 0;

    const result: {
      id: number;
      title: string;
      posterPath: string;
      type: MediaType;
      imdbId: string;
    }[] = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('media.tmdbId', 'id')
      .addSelect('media.title', 'title')
      .addSelect('media.posterPath', 'posterPath')
      .addSelect('media.type', 'type')
      .addSelect('media.imdbId', 'imdbId')
      .where('lmi.listId = :listId', { listId: id })
      .orderBy('lmi.position', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany();

    return {
      results: result,
      totalPages: Math.ceil(total / limit),
      page,
      totalResults: total,
    };
  }

  async getMediaTypeStats(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const result: {
      type: MediaType;
      count: string;
    }[] = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('media.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('lmi.listId = :listId', { listId })
      .groupBy('media.type')
      .getRawMany();

    const mediaTypeStats = result.reduce(
      (acc, { type, count }) => {
        acc[type] = parseInt(count);
        return acc;
      },
      {} as Record<MediaType, number>,
    );

    return mediaTypeStats;
  }

  async getRatingStats(
    listId: string,
    userId: string,
    query: GetRatingStatsQueryDto,
  ) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const qb = this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('lmi.userRating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('lmi.listId = :listId', { listId })
      .andWhere('lmi.userRating IS NOT NULL')
      .groupBy('rating')
      .orderBy('count', 'DESC');

    if (query.genre) {
      qb.andWhere(':genre = ANY(media.genres)', { genre: query.genre });
    }

    if (query.year) {
      qb.andWhere('media.year = :year', { year: query.year });
    }

    if (query.type) {
      qb.andWhere('media.type = :type', { type: query.type });
    }

    const result: { rating: string; count: string }[] = await qb.getRawMany();
    const ratingStats = Array.from({ length: 10 }, (_, i) => i + 1).reduce(
      (acc, rating) => {
        const found = result.find((r) => Number(r.rating) === rating);
        acc[rating] = found ? parseInt(found.count) : 0;
        return acc;
      },
      {} as Record<number, number>,
    );

    return ratingStats;
  }

  async getGenres(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const result: { genre: string }[] = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('DISTINCT unnest(media.genres)', 'genre')
      .where('lmi.listId = :listId', { listId })
      .orderBy('genre', 'ASC')
      .getRawMany();

    const genres = result.map((row) => row.genre);

    return genres;
  }

  async getYears(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const result: { year: number }[] = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('DISTINCT media.year', 'year')
      .where('lmi.listId = :listId', { listId })
      .andWhere('media.year IS NOT NULL')
      .orderBy('year', 'ASC')
      .getRawMany();

    const years = result.map((row) => row.year);

    return years;
  }

  async getYearsAnalytics(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const result: { year: string; count: string }[] =
      await this.listMediaItemsRepository
        .createQueryBuilder('lmi')
        .innerJoin('lmi.mediaItem', 'media')
        .select('media.year', 'year')
        .addSelect('COUNT(*)', 'count')
        .where('lmi.listId = :listId', { listId })
        .groupBy('year')
        .orderBy('count', 'DESC')
        .getRawMany();

    const yearStats = result.reduce(
      (acc, { year, count }) => {
        acc[year] = parseInt(count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return yearStats;
  }

  async getAmountStats(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const total = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .where('lmi.listId = :listId', { listId })
      .getCount();

    const totalMoviesRuntime = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('SUM(media.runtime)', 'totalRuntime')
      .where('lmi.listId = :listId', { listId })
      .andWhere('media.type = :type', { type: MediaType.MOVIE })
      .getRawOne();

    const totalTVShowsRuntime = await this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('SUM(media.runtime * media.numberOfEpisodes)', 'totalRuntime')
      .where('lmi.listId = :listId', { listId })
      .andWhere('media.type = :type', { type: MediaType.TV })
      .getRawOne();

    return {
      total,
      totalMoviesRuntime: totalMoviesRuntime.totalRuntime,
      totalTVShowsRuntime: totalTVShowsRuntime.totalRuntime,
      totalRuntime:
        Number(totalMoviesRuntime.totalRuntime) +
        Number(totalTVShowsRuntime.totalRuntime),
    };
  }

  async getUpcomingTVShows(
    listId: string,
    userId: string,
    query: GetMediaItemsQueryDto,
  ) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const { page = 1, limit = 10 } = query;

    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const qb = this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .select('media.tmdbId', 'id')
      .addSelect('media.title', 'title')
      .addSelect('media.posterPath', 'posterPath')
      .where('lmi.listId = :listId', { listId })
      .andWhere('media.type = :type', { type: MediaType.TV })
      .andWhere('media.nextEpisodeAirDate IS NOT NULL')
      .andWhere('media.nextEpisodeAirDate BETWEEN :now AND :oneYearFromNow', {
        now,
        oneYearFromNow,
      })
      .orderBy('media.nextEpisodeAirDate', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const items = await qb.getRawMany();

    const countQb = this.listMediaItemsRepository
      .createQueryBuilder('lmi')
      .innerJoin('lmi.mediaItem', 'media')
      .where('lmi.listId = :listId', { listId })
      .andWhere('media.type = :type', { type: MediaType.TV })
      .andWhere('media.nextEpisodeAirDate IS NOT NULL')
      .andWhere('media.nextEpisodeAirDate BETWEEN :now AND :oneYearFromNow', {
        now,
        oneYearFromNow,
      });

    const total = await countQb.getCount();

    return {
      results: items,
      totalPages: Math.ceil(total / limit),
      page,
      totalResults: total,
    };
  }

  async getCountryAnalytics(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const result: { country: string; count: string }[] =
      await this.listMediaItemsRepository
        .createQueryBuilder('lmi')
        .innerJoin('lmi.mediaItem', 'media')
        .select('unnest(media.countries)', 'country')
        .addSelect('COUNT(*)', 'count')
        .where('lmi.listId = :listId', { listId })
        .groupBy('country')
        .orderBy('count', 'DESC')
        .getRawMany();

    const countryStats = result.reduce(
      (acc, { country, count }) => {
        acc[country] = parseInt(count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return countryStats;
  }

  async getCompanyAnalytics(listId: string, userId: string) {
    const list = await this.findOne(listId, userId);
    this.checkListStatus(list);

    const result: { company: string; count: string }[] =
      await this.listMediaItemsRepository
        .createQueryBuilder('lmi')
        .innerJoin('lmi.mediaItem', 'media')
        .select('unnest(media.companies)', 'company')
        .addSelect('COUNT(*)', 'count')
        .where('lmi.listId = :listId', { listId })
        .groupBy('company')
        .orderBy('count', 'DESC')
        .limit(40)
        .getRawMany();

    const companyStats = result.reduce(
      (acc, { company, count }) => {
        acc[company] = parseInt(count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return companyStats;
  }

  private checkListStatus(list: List) {
    if (list.status !== ListStatus.COMPLETED) {
      throw new BadRequestException(
        list.status === ListStatus.PROCESSING
          ? 'List is still processing. Please try again later.'
          : `List processing failed: ${list.errorMessage || 'Unknown error.'}`,
      );
    }
  }
}
