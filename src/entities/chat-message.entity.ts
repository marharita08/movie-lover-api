import { Column, Entity, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { MediaType } from './media-item.entity';
import { User } from './user.entity';

export enum MessageAuthor {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface MediaItemRecommendation {
  type: MediaType;
  id: number;
  title: string;
  posterPath: string | null;
}

@Entity({ name: 'chat_message' })
export class ChatMessage extends BaseEntity {
  @Column()
  text: string;

  @Column({
    type: 'enum',
    enum: MessageAuthor,
  })
  author: MessageAuthor;

  @Column()
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  mediaItems: MediaItemRecommendation[] | null;

  @ManyToOne(() => User, (user) => user.chatMessages, { onDelete: 'CASCADE' })
  user: User;
}
