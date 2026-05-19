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
};
