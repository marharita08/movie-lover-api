import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { GetUser } from 'src/modules/auth/decorators';

import {
  CreateListDto,
  GetListsQueryDto,
  GetMediaItemsQueryDto,
  GetPersonStatsQuery,
  GetRatingStatsQueryDto,
} from './dto';
import { ListService } from './list.service';

@Controller('list')
export class ListController {
  constructor(private readonly listService: ListService) {}

  @Post()
  create(@Body() dto: CreateListDto, @GetUser('id') userId: string) {
    return this.listService.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: GetListsQueryDto, @GetUser('id') userId: string) {
    return this.listService.findAll(query, userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.findOne(id, userId);
  }

  @Delete(':id')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.delete(id, userId);
  }

  @Get(':id/genre/stats')
  getGenreStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getGenreAnalytics(id, userId);
  }

  @Get(':id/person/stats')
  getPersonStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetPersonStatsQuery,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getPersonsAnalytics(id, userId, query);
  }

  @Get(':id/media')
  getMediaItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetMediaItemsQueryDto,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getMediaItems(id, userId, query);
  }

  @Get(':id/media-type/stats')
  getMediaTypeStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getMediaTypeStats(id, userId);
  }

  @Get(':id/rating/stats')
  getRatingStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetRatingStatsQueryDto,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getRatingStats(id, userId, query);
  }

  @Get(':id/genres')
  getGenres(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getGenres(id, userId);
  }

  @Get(':id/years')
  getYears(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getYears(id, userId);
  }

  @Get(':id/years/stats')
  getYearsStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getYearsAnalytics(id, userId);
  }

  @Get(':id/amount/stats')
  getAmountStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getAmountStats(id, userId);
  }

  @Get(':id/tv/upcoming')
  getUpcomingTvShows(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
    @Query() query: GetMediaItemsQueryDto,
  ) {
    return this.listService.getUpcomingTVShows(id, userId, query);
  }

  @Get(':id/country/stats')
  getCountryStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getCountryAnalytics(id, userId);
  }

  @Get(':id/company/stats')
  getCompanyStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getCompanyAnalytics(id, userId);
  }
}
