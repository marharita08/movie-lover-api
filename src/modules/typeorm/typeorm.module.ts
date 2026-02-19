import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  File,
  List,
  MediaItem,
  MediaPerson,
  Otp,
  Person,
  ResetPasswordToken,
  Session,
  User,
} from 'src/entities';
import { ListMediaItem } from 'src/entities/list-media-item.entity';

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
        synchronize: true,
      }),
    }),
  ],
})
export class TypeormModule {}
