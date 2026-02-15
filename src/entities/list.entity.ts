import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { File } from './file.entity';
import { User } from './user.entity';

@Entity()
export class List extends BaseEntity {
  @Column()
  name: string;

  @Column()
  fileId: string;

  @Column()
  userId: string;

  @OneToOne(() => File, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: File;

  @ManyToOne(() => User, (user) => user.lists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
