import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StorageModule } from '../storage/storage.module';

import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule, StorageModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
