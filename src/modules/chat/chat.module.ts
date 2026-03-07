import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from '../../entities/chat-message.entity';
import { AiModule } from '../ai/ai.module';
import { ListModule } from '../list/list.module';
import { TmdbModule } from '../tmdb/tmdb.module';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage]),
    AiModule,
    ListModule,
    TmdbModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
