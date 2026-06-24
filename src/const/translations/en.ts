import { TranslationKeys } from './keys';

export const en: Record<TranslationKeys, string> = {
  [TranslationKeys.CHAT_WELCOME_MESSAGE]: `Hi! I'm your personal movie and TV show recommendation assistant. I can help you discover new content based on your IMDb lists and preferences.

You can ask me things like:
- "Recommend me something similar to Inception"
- "What are some good sci-fi movies?"
- "I want to watch a comedy series"
- "Suggest movies based on my watchlist"

What would you like to watch today?`,
  [TranslationKeys.OTP_EMAIL_BODY]:
    'Your verification code is {code}. This code will expire in 10 minutes.',
  [TranslationKeys.OTP_EMAIL_SUBJECT_EMAIL_VERIFICATION]: 'Email Verification',
  [TranslationKeys.OTP_EMAIL_SUBJECT_RESET_PASSWORD]: 'Reset Password',
  [TranslationKeys.OTP_SENT_RESPONSE]:
    'We sent you an email with a verification code',
  [TranslationKeys.ERROR_EMAIL_TAKEN]: 'Email already taken',
  [TranslationKeys.ERROR_INVALID_CREDENTIALS]: 'Invalid credentials',
  [TranslationKeys.PASSWORD_RESET_EMAIL_SUBJECT]: 'Password Reset',
  [TranslationKeys.PASSWORD_RESET_EMAIL_SENT]:
    'We sent you an email with a reset code',
  [TranslationKeys.ERROR_AUTHORIZATION_FAILED]: 'Authorization failed',
  [TranslationKeys.ERROR_SESSION_NOT_FOUND]: 'Session not found',
  [TranslationKeys.ERROR_INVALID_TOKEN]:
    'Your token has expired or is not valid',
  [TranslationKeys.ERROR_RECOMMENDATIONS_FAILED]:
    'An error occurred while generating recommendations. Please try again.',
  [TranslationKeys.ERROR_CSV_EMPTY]: 'CSV file is empty',
  [TranslationKeys.ERROR_EMAIL_SEND_FAILED]: 'Unable to send email',
  [TranslationKeys.VALIDATION_FAILED]: 'Validation failed. {details}',
  [TranslationKeys.VALIDATION_FAILED_ROWS]:
    'Validation failed for at least {count} rows. First errors - {details}. Please fix the errors and try again.',
  [TranslationKeys.ERROR_FILE_NOT_FOUND]: 'File not found',
  [TranslationKeys.ERROR_FILE_NOT_FOUND_OR_ACCESS_DENIED]:
    'File not found or access denied',
  [TranslationKeys.ERROR_LIST_NOT_FOUND]: 'List with ID {id} not found',
  [TranslationKeys.ERROR_LIST_STILL_PROCESSING]:
    'List is still processing. Please try again later.',
  [TranslationKeys.ERROR_LIST_PROCESSING_FAILED]:
    'List processing failed: {error}',
  [TranslationKeys.ERROR_OTP_RESEND_WAIT]:
    'Please wait {seconds} seconds before resending OTP',
  [TranslationKeys.ERROR_OTP_INVALID_OR_EXPIRED]: 'Invalid or expired OTP',
  [TranslationKeys.ERROR_TOKEN_INVALID_OR_EXPIRED]: 'Invalid or expired token',
  [TranslationKeys.ERROR_MOVIES_FETCH_FAILED]: 'Failed to fetch movies',
  [TranslationKeys.ERROR_MOVIE_NOT_FOUND]: 'Movie not found',
  [TranslationKeys.ERROR_MOVIE_DETAILS_FETCH_FAILED]:
    'Failed to fetch movie details',
  [TranslationKeys.ERROR_TV_SHOW_NOT_FOUND]: 'TV show not found',
  [TranslationKeys.ERROR_TV_SHOW_DETAILS_FETCH_FAILED]:
    'Failed to fetch TV show details',
  [TranslationKeys.ERROR_PERSON_NOT_FOUND]: 'Person not found',
  [TranslationKeys.ERROR_PERSON_FETCH_FAILED]: 'Failed to get person',
  [TranslationKeys.ERROR_SEARCH_FAILED]: 'Failed to search',
  [TranslationKeys.ERROR_USER_NOT_FOUND]: 'User not found',
  [TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE]:
    'AI service is currently unavailable. Please try again later.',
  [TranslationKeys.ERROR_LIST_FILE_DOWNLOAD_FAILED]:
    'Failed to download list file. Please try again.',
  [TranslationKeys.ERROR_LIST_FILE_UPLOAD_FAILED]:
    'Failed to process list file. Please try again.',
  [TranslationKeys.ERROR_AI_RESPONSE_PARSE_FAILED]:
    'Failed to parse recommendations. Please try again.',
  [TranslationKeys.ERROR_AI_RATE_LIMIT]:
    'Too many requests to the AI service. Please try again later.',
  [TranslationKeys.ERROR_AI_SAFETY_BLOCK]:
    'The request could not be processed due to safety restrictions. Please rephrase your message and try again.',
  [TranslationKeys.ERROR_AI_UNEXPECTED_ERROR]:
    'Unexpected error happend while getting response from AI.',
  [TranslationKeys.ERROR_CSV_NO_FILE]: 'No file provided',
  [TranslationKeys.ERROR_CSV_INVALID_EXTENSION]:
    'Invalid file extension. Expected .csv but got {extension}',
  [TranslationKeys.ERROR_CSV_INVALID_MIME_TYPE]:
    'Invalid MIME type. Expected CSV but got {mimeType}',
  [TranslationKeys.ERROR_CSV_FILE_EMPTY]: 'File is empty',
};
