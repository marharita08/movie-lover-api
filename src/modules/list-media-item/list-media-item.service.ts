import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ListMediaItem } from 'src/entities';
import { MediaItemService } from 'src/modules/media-item/media-item.service';

import { IMDBRow } from '../list/dto';

@Injectable()
export class ListMediaItemService {
  private readonly logger = new Logger(ListMediaItemService.name);

  constructor(
    @InjectRepository(ListMediaItem)
    private readonly listMediaItemRepository: Repository<ListMediaItem>,
    private readonly mediaItemService: MediaItemService,
  ) {}

  async add(listId: string, row: IMDBRow, position: number) {
    try {
      const mediaItem = await this.mediaItemService.getOrCreate(row);

      const listMediaItem = this.listMediaItemRepository.create({
        listId,
        mediaItemId: mediaItem.id,
        userRating: row['Your Rating'] ? parseInt(row['Your Rating']) : null,
        dateRated: row['Date Rated'] ? new Date(row['Date Rated']) : null,
        position,
      });

      await this.listMediaItemRepository.save(listMediaItem);
    } catch (error) {
      this.logger.error(`Error processing media item ${row.Const}:`, error);
    }
  }
}
