import { ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { appConfig } from './config';
import { injectUserMiddleware } from './modules/auth/middleware/inject-user.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.enableCors({
    origin: config.frontendUrl,
    credentials: true,
  });
  app.use(cookieParser());
  app.use(injectUserMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validateCustomDecorators: true,
    }),
  );

  await app.listen(config.port);
}
void bootstrap();
