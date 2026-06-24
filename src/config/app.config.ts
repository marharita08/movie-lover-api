import { registerAs } from '@nestjs/config';

import { NodeEnv } from './node-env.enum';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV as NodeEnv,
  port: parseInt(process.env.PORT ?? '3001', 10),
  frontendUrl: process.env.FRONTEND_URL as string,
}));
