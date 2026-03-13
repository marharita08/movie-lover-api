import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
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
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        migrationsRun: config.get<string>('NODE_ENV') === 'production',
        migrations: [__dirname + '/../migrations/*.js'],
      }),
    }),
  ],
})
export class TypeormModule {}
