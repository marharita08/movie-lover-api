import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  AuthService,
  HashService,
  SessionService,
  TokenService,
} from './services';
import { UserModule } from '../user';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Otp, Session } from 'src/entities';
import { OtpModule } from '../otp/otp.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([User, Otp, Session]),
    JwtModule.register({}),
    ConfigModule,
    OtpModule,
    EmailModule,
  ],
  providers: [AuthService, HashService, SessionService, TokenService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
