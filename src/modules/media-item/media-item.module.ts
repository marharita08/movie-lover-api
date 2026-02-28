import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MediaItem } from 'src/entities';
import { MediaPersonModule } from 'src/modules/media-person/media-person.module';
import { TmdbModule } from 'src/modules/tmdb/tmdb.module';

import { MediaItemService } from './media-item.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaItem]),
    ScheduleModule.forRoot(),
    TmdbModule,
    MediaPersonModule,
  ],
  providers: [MediaItemService],
  exports: [MediaItemService],
})
export class MediaItemModule {}
