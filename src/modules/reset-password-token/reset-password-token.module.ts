import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ResetPasswordToken } from 'src/entities';
import { HashModule } from 'src/modules/hash/hash.module';

import { ResetPasswordTokenService } from './reset-password-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResetPasswordToken]), HashModule],
  providers: [ResetPasswordTokenService],
  exports: [ResetPasswordTokenService],
})
export class ResetPasswordTokenModule {}
