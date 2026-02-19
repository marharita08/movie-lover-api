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
import { PersonRole } from 'src/entities';

import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateListDto, GetListsQueryDto, UpdateListDto } from './dto';
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
    @Query('role') role: PersonRole,
    @GetUser('id') userId: string,
  ) {
    return this.listService.getPersonsAnalytics(id, userId, role);
  }
}
