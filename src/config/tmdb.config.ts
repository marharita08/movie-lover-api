import { registerAs } from '@nestjs/config';

export const tmdbConfig = registerAs('tmdb', () => ({
  url: process.env.TMDB_URL as string,
  token: process.env.TMDB_TOKEN as string,
}));
