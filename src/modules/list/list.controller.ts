import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  CreateListDto,
  GetListsQueryDto,
  GetMediaItemsQueryDto,
  UpdateListDto,
} from './dto';
import { GetPersonStatsQuery } from './dto/get-person-stats-query.dto';
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

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListDto,
    @GetUser('id') userId: string,
  ) {
    return this.listService.update(id, dto, userId);
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
}
