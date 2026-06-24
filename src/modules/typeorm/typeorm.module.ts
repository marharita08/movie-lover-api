import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { appConfig, databaseConfig } from 'src/config';
import { NodeEnv } from 'src/config/node-env.enum';
import {
  ChatMessage,
  File,
  List,
  ListMediaItem,
  MediaItem,
  MediaPerson,
  Otp,
  Person,
  ResetPasswordToken,
  Session,
  User,
} from 'src/entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [databaseConfig.KEY, appConfig.KEY],
      useFactory: (
        dbConfig: ConfigType<typeof databaseConfig>,
        app: ConfigType<typeof appConfig>,
      ) => ({
        type: 'postgres',
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.name,
        entities: [
          ChatMessage,
          User,
          Otp,
          ResetPasswordToken,
          Session,
          File,
          List,
          ListMediaItem,
          MediaItem,
          Person,
          MediaPerson,
        ],
        synchronize: app.nodeEnv === NodeEnv.DEVELOPMENT,
        migrationsRun: app.nodeEnv === NodeEnv.PRODUCTION,
        migrations: [__dirname + '/../../migrations/*.js'],
      }),
    }),
  ],
})
export class TypeormModule {}
