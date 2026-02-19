import { Column, Entity, Index, OneToMany } from 'typeorm';

import { BaseEntity } from './base.entity';
import { ListMediaItem } from './list-media-item.entity';
import { MediaPerson } from './media-person.entity';

export enum MediaType {
  MOVIE = 'movie',
  TV = 'tv',
}

@Entity()
export class MediaItem extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  @Index()
  imdbId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({
    type: 'enum',
    enum: MediaType,
  })
  @Index()
  type: MediaType;

  @Column('text', { array: true, default: [] })
  genres: string[];

  @Column({ type: 'int', nullable: true })
  @Index()
  year: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  imdbRating: number | null;

  @Column({ type: 'int', nullable: true })
  runtime: number | null;

  @Column({ type: 'int', nullable: true })
  @Index()
  tmdbId: number | null;

  @Column({ type: 'varchar', nullable: true })
  posterPath: string | null;

  @Column({ type: 'int', nullable: true })
  numberOfSeasons: number | null;

  @Column({ type: 'int', nullable: true })
  numberOfEpisodes: number | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @OneToMany(() => ListMediaItem, (listMediaItem) => listMediaItem.mediaItem)
  listMediaItems: ListMediaItem[];

  @OneToMany(() => MediaPerson, (mediaPerson) => mediaPerson.mediaItem)
  mediaPersons: MediaPerson[];
}
