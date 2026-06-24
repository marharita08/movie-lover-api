import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => {
  const host = process.env.REDIS_HOST as string;
  const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);

  return {
    host,
    port,
    cacheTtl: parseInt(process.env.CACHE_TTL ?? '86400', 10),
    url: `redis://${host}:${port}`,
  };
});
