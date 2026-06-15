import KeyvRedis from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { I18nModule } from 'nestjs-i18n';

import { Language } from './entities';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessTokenGuard } from './modules/auth/guards';
import { ChatModule } from './modules/chat/chat.module';
import { CsvParserModule } from './modules/csv-parser/csv-parser.module';
import { FileModule } from './modules/file/file.module';
import { TsLoader } from './modules/i18n/i18n.loader';
import { UserLanguageResolver } from './modules/i18n/i18n.resolver';
import { ListModule } from './modules/list/list.module';
import { StorageModule } from './modules/storage/storage.module';
import { TmdbModule } from './modules/tmdb/tmdb.module';
import { TypeormModule } from './modules/typeorm/typeorm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          new KeyvRedis(
            `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
          ),
        ],
        ttl: configService.get<number>('CACHE_TTL'),
      }),
    }),
    ScheduleModule.forRoot(),
    I18nModule.forRoot({
      fallbackLanguage: Language.ENGLISH,
      loader: TsLoader,
      loaderOptions: {},
      resolvers: [UserLanguageResolver],
    }),
    AuthModule,
    TypeormModule,
    TmdbModule,
    FileModule,
    ListModule,
    StorageModule,
    CsvParserModule,
    AiModule,
    ChatModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
