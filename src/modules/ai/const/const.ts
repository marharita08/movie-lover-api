import { HttpStatus } from '@nestjs/common';

export const FILE_PROCESSING_TIMEOUT_MS = 60_000;
export const FILE_PROCESSING_POLL_INTERVAL_MS = 1_000;

export const RETRIES_PER_MODEL = 3;
export const RETRY_BASE_DELAY_MS = 1_000;
export const RETRY_MAX_DELAY_MS = 15_000;

export const RETRYABLE_STATUSES = new Set([
  HttpStatus.TOO_MANY_REQUESTS,
  HttpStatus.INTERNAL_SERVER_ERROR,
  HttpStatus.SERVICE_UNAVAILABLE,
]);

export const GENERATE_TIMEOUT_MS = 90_000;

export enum GeminiModel {
  FLASH = 'gemini-2.5-flash',
  FLASH_LITE = 'gemini-2.5-flash-lite',
}
