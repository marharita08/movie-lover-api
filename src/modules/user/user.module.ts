import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities';

import { FileModule } from '../file/file.module';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), FileModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
