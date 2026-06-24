import { registerAs } from '@nestjs/config';

export const brevoConfig = registerAs('brevo', () => ({
  apiKey: process.env.BREVO_API_KEY as string,
  fromEmail: process.env.BREVO_FROM_EMAIL as string,
  fromName: process.env.BREVO_FROM_NAME as string,
}));
