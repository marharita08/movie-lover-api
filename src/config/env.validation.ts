import * as Joi from 'joi';

import { NodeEnv } from './node-env.enum';

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid(...Object.values(NodeEnv))
    .default(NodeEnv.DEVELOPMENT),
  PORT: Joi.number().default(3001),
  FRONTEND_URL: Joi.string().uri().required(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_TTL: Joi.string().required(),
  JWT_REFRESH_TTL: Joi.string().required(),

  // Email (Brevo)
  BREVO_API_KEY: Joi.string().required(),
  BREVO_FROM_EMAIL: Joi.string().email().required(),
  BREVO_FROM_NAME: Joi.string().required(),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // TMDB
  TMDB_URL: Joi.string().uri().required(),
  TMDB_TOKEN: Joi.string().required(),

  // Google Cloud Storage
  GCP_PROJECT_ID: Joi.string().required(),
  GCP_BUCKET_NAME: Joi.string().required(),
  GCP_CLIENT_EMAIL: Joi.string().email().required(),
  GCP_PRIVATE_KEY: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  CACHE_TTL: Joi.number().default(86400),

  // Gemini
  GEMINI_API_KEY: Joi.string().required(),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
});
