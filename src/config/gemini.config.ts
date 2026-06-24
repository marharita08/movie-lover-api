import { registerAs } from '@nestjs/config';

export const geminiConfig = registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY as string,
}));
