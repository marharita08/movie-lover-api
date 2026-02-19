import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaItem, MediaPerson, Person } from 'src/entities';
import { List } from 'src/entities/list.entity';
import { ListMediaItem } from 'src/entities/list-media-item.entity';

import { FileModule } from '../file/file.module';
import { ListController } from './list.controller';
import { ListService } from './list.service';
import { CsvParserModule } from '../csv-parser/csv-parser.module';
import { TmdbModule } from '../tmdb/tmdb.module';

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
