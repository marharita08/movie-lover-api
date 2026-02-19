import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { File } from './file.entity';
import { ListMediaItem } from './list-media-item.entity';
import { User } from './user.entity';

export enum ListStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity()
export class List extends BaseEntity {
  @Column()
  name: string;

  @Column()
  fileId: string;

  @Column()
  userId: string;

  @Column({ type: 'int', default: 0 })
  totalItems: number;

  @Column({
    type: 'enum',
    enum: ListStatus,
    default: ListStatus.PROCESSING,
  })
  status: ListStatus;

  @Column({ nullable: true })
  errorMessage: string;

  @OneToOne(() => File, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: File;

  @ManyToOne(() => User, (user) => user.lists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => ListMediaItem, (listMediaItem) => listMediaItem.list, {
    cascade: true,
  })
  listMediaItems: ListMediaItem[];
}
