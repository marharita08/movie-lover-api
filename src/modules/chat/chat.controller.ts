import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';

import { GetUser } from '../auth/decorators';

import { ChatService } from './chat.service';
import { ChatHistoryQueryDto } from './dto/chat-history-query.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history')
  async getChatHistory(
    @GetUser('id') userId: string,
    @Query() query: ChatHistoryQueryDto,
  ) {
    return this.chatService.getChatHistory(userId, query);
  }

  @Post('message')
  async sendMessage(
    @GetUser('id') userId: string,
    @Body('message') message: string,
  ) {
    return this.chatService.processUserMessage(userId, message);
  }

  @Delete('clear')
  async clearHistory(@GetUser('id') userId: string) {
    return this.chatService.clearChatHistory(userId);
  }
}
