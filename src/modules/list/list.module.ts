import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  List,
  ListMediaItem,
  MediaItem,
  MediaPerson,
  Person,
} from 'src/entities';
import { CsvParserModule } from 'src/modules/csv-parser/csv-parser.module';
import { FileModule } from 'src/modules/file/file.module';
import { TmdbModule } from 'src/modules/tmdb/tmdb.module';

import { ListController } from './list.controller';
import { ListService } from './list.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      List,
      ListMediaItem,
      MediaItem,
      Person,
      MediaPerson,
    ]),
    FileModule,
    TmdbModule,
    CsvParserModule,
  ],
  controllers: [ListController],
  providers: [ListService],
  exports: [ListService],
})
export class ListModule {}
