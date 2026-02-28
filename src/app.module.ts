import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { AccessTokenGuard } from './modules/auth/guards';
import { CsvParserModule } from './modules/csv-parser/csv-parser.module';
import { FileModule } from './modules/file/file.module';
import { ListModule } from './modules/list/list.module';
import { StorageModule } from './modules/storage/storage.module';
import { TmdbModule } from './modules/tmdb/tmdb.module';
import { TypeormModule } from './modules/typeorm/typeorm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    TypeormModule,
    TmdbModule,
    FileModule,
    ListModule,
    StorageModule,
    CsvParserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
