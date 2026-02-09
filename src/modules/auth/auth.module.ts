import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Otp, Session, User } from 'src/entities';

import { EmailModule } from '../email/email.module';
import { HashModule } from '../hash/hash.module';
import { OtpModule } from '../otp/otp.module';
import { ResetPasswordTokenModule } from '../reset-password-token/reset-password-token.module';
import { UserModule } from '../user';
import { AuthController } from './auth.controller';
import { AuthService, SessionService, TokenService } from './services';
import { AccessTokenStrategy } from './strategies/access-token.strategy';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([User, Otp, Session]),
    JwtModule.register({}),
    ConfigModule,
    OtpModule,
    EmailModule,
    HashModule,
    ResetPasswordTokenModule,
  ],
  providers: [AuthService, SessionService, TokenService, AccessTokenStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
