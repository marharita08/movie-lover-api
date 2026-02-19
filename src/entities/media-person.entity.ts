import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { MediaItem } from './media-item.entity';
import { Person, PersonRole } from './person.entity';

@Entity()
@Index(['mediaItemId', 'personId', 'role'], { unique: true })
export class MediaPerson extends BaseEntity {
  @Column()
  @Index()
  mediaItemId: string;

  @Column()
  @Index()
  personId: string;

  @Column({
    type: 'enum',
    enum: PersonRole,
  })
  @Index()
  role: PersonRole;

  @ManyToOne(() => MediaItem, (mediaItem) => mediaItem.mediaPersons, {
    onDelete: 'CASCADE',
  })
  mediaItem: MediaItem;

  @ManyToOne(() => Person, (person) => person.mediaPersons, {
    onDelete: 'CASCADE',
  })
  person: Person;
}
