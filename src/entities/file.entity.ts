import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { List } from './list.entity';
import { User } from './user.entity';

@Entity()
export class File extends BaseEntity {
  @Column()
  name: string;

  @Column()
  key: string;

  @Column()
  url: string;

  @Column()
  type: string;

  @Column()
  size: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => List, (list) => list.file, { onDelete: 'CASCADE' })
  list: List;
}
