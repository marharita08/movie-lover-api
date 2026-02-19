import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { List } from './list.entity';
import { MediaItem } from './media-item.entity';

@Entity()
@Index(['listId', 'mediaItemId'], { unique: true })
export class ListMediaItem extends BaseEntity {
  @Column()
  @Index()
  listId: string;

  @Column()
  @Index()
  mediaItemId: string;

  @Column({ type: 'int', nullable: true })
  userRating: number | null;

  @Column({ type: 'date', nullable: true })
  dateRated: Date | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @ManyToOne(() => List, (list) => list.listMediaItems, { onDelete: 'CASCADE' })
  list: List;

  @ManyToOne(() => MediaItem, (mediaItem) => mediaItem.listMediaItems, {
    onDelete: 'CASCADE',
  })
  mediaItem: MediaItem;
}
