import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET as string,
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  ttl: process.env.JWT_TTL as string,
  refreshTtl: process.env.JWT_REFRESH_TTL as string,
}));
