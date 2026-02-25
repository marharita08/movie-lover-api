import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ListMediaItem } from 'src/entities';
import { MediaItemModule } from 'src/modules/media-item/media-item.module';

import { ListMediaItemService } from './list-media-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([ListMediaItem]), MediaItemModule],
  providers: [ListMediaItemService],
  exports: [ListMediaItemService],
})
export class ListMediaItemModule {}
