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

  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.files, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => List, (list) => list.file, { onDelete: 'SET NULL' })
  list: List;
}
