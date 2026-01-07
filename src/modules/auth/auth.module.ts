import { Module } from '@nestjs/common';
import {
  AuthService,
  HashService,
  SessionService,
  TokenService,
} from './services';
import { UserModule } from '../user';
import { AuthController } from './auth.controller';

@Module({
  imports: [UserModule],
  providers: [AuthService, HashService, SessionService, TokenService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
