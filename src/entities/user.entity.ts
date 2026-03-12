import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from './base.entity';
import { ChatMessage } from './chat-message.entity';
import { File } from './file.entity';
import { List } from './list.entity';

@Entity({ name: 'user' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'timestamptz' })
  lastLoginAt: Date;

  @Column({ type: 'timestamptz' })
  lastActiveAt: Date;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  googleId?: string;

  @OneToMany(() => File, (file) => file.user)
  files: File[];

  @OneToMany(() => List, (list) => list.user)
  lists: List[];

  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.user)
  chatMessages: ChatMessage[];
}
