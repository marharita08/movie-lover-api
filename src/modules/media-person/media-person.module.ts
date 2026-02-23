import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MediaPerson } from 'src/entities';
import { PersonModule } from 'src/modules/person/person.module';
import { TmdbModule } from 'src/modules/tmdb/tmdb.module';

import { MediaPersonService } from './media-person.service';

@Module({
  imports: [TypeOrmModule.forFeature([MediaPerson]), TmdbModule, PersonModule],
  providers: [MediaPersonService],
  exports: [MediaPersonService],
})
export class MediaPersonModule {}
