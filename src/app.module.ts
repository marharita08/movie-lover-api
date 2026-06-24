import KeyvRedis from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { I18nModule } from 'nestjs-i18n';

import {
  appConfig,
  brevoConfig,
  databaseConfig,
  gcpConfig,
  geminiConfig,
  googleOAuthConfig,
  jwtConfig,
  redisConfig,
  tmdbConfig,
} from './config';
import { Language } from './entities';
import { envValidationSchema } from './config/env.validation';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessTokenGuard } from './modules/auth/guards';
import { ChatModule } from './modules/chat/chat.module';
import { CsvParserModule } from './modules/csv-parser/csv-parser.module';
import { FileModule } from './modules/file/file.module';
import { ListModule } from './modules/list/list.module';
import { StorageModule } from './modules/storage/storage.module';
import { TmdbModule } from './modules/tmdb/tmdb.module';
import { TsLoader } from './modules/translation/i18n.loader';
import { UserLanguageResolver } from './modules/translation/i18n.resolver';
import { TranslationModule } from './modules/translation/translation.module';
import { TypeormModule } from './modules/typeorm/typeorm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
      load: [
        appConfig,
        jwtConfig,
        brevoConfig,
        databaseConfig,
        tmdbConfig,
        gcpConfig,
        redisConfig,
        geminiConfig,
        googleOAuthConfig,
      ],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        stores: [new KeyvRedis(config.url)],
        ttl: config.cacheTtl,
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
    TranslationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
