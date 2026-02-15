import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { List } from 'src/entities/list.entity';

import { FileModule } from '../file/file.module';
import { ListController } from './list.controller';
import { ListService } from './list.service';

@Module({
  imports: [TypeOrmModule.forFeature([List]), FileModule],
  controllers: [ListController],
  providers: [ListService],
})
export class ListModule {}
