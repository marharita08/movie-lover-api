import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { AccessTokenGuard } from './modules/auth/guards/access-token.guard';
import { APP_GUARD } from '@nestjs/core';
import { TypeormModule } from './modules/typeorm/typeorm.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    AuthModule,
    TypeormModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
