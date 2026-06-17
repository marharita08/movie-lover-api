import { TranslationKeys } from './keys';

export const uk: Record<TranslationKeys, string> = {
  [TranslationKeys.CHAT_WELCOME_MESSAGE]: `Привіт! Я твій особистий помічник з рекомендацій фільмів та серіалів. Я можу допомогти тобі знайти новий контент на основі твоїх списків IMDb та уподобань.

Ти можеш запитати мене про щось на зразок:
- "Порекомендуй мені щось схоже на Початок"
- "Які є хороші науково-фантастичні фільми?"
- "Хочу подивитися комедійний серіал"
- "Запропонуй фільми на основі мого списку перегляду"

Що ти хочеш подивитися сьогодні?`,
  [TranslationKeys.OTP_EMAIL_BODY]:
    'Ваш код підтвердження: {code}. Код дійсний 10 хвилин.',
  [TranslationKeys.OTP_EMAIL_SUBJECT_EMAIL_VERIFICATION]: 'Підтвердження email',
  [TranslationKeys.OTP_EMAIL_SUBJECT_RESET_PASSWORD]: 'Скидання пароля',
  [TranslationKeys.OTP_SENT_RESPONSE]:
    'Ми надіслали вам email з кодом підтвердження',
  [TranslationKeys.ERROR_EMAIL_TAKEN]: 'Цей email вже зайнятий',
  [TranslationKeys.ERROR_INVALID_CREDENTIALS]: 'Невірні дані для входу',
  [TranslationKeys.PASSWORD_RESET_EMAIL_SUBJECT]: 'Скидання пароля',
  [TranslationKeys.PASSWORD_RESET_EMAIL_SENT]:
    'Ми надіслали вам email з кодом для скидання пароля',
  [TranslationKeys.ERROR_AUTHORIZATION_FAILED]: 'Авторизація не вдалась',
  [TranslationKeys.ERROR_SESSION_NOT_FOUND]: 'Сесію не знайдено',
  [TranslationKeys.ERROR_INVALID_TOKEN]: 'Ваш токен закінчився або є недійсним',
  [TranslationKeys.ERROR_RECOMMENDATIONS_FAILED]:
    'Виникла помилка під час генерації рекомендацій. Будь ласка, спробуйте ще раз.',
  [TranslationKeys.ERROR_CSV_EMPTY]: 'CSV файл порожній',
  [TranslationKeys.ERROR_EMAIL_SEND_FAILED]: 'Не вдалось надіслати email',
  [TranslationKeys.VALIDATION_FAILED]: 'Помилка валідації. {details}',
  [TranslationKeys.VALIDATION_FAILED_ROWS]:
    'Помилка валідації щонайменше у {count} рядках. Перші помилки - {details}. Будь ласка, виправте помилки та спробуйте знову.',
  [TranslationKeys.ERROR_FILE_NOT_FOUND]: 'Файл не знайдено',
  [TranslationKeys.ERROR_FILE_NOT_FOUND_OR_ACCESS_DENIED]:
    'Файл не знайдено або доступ заборонено',
  [TranslationKeys.ERROR_LIST_NOT_FOUND]: 'Список з ID {id} не знайдено',
  [TranslationKeys.ERROR_LIST_STILL_PROCESSING]:
    'Список ще обробляється. Будь ласка, спробуйте пізніше.',
  [TranslationKeys.ERROR_LIST_PROCESSING_FAILED]:
    'Помилка обробки списку: {error}',
  [TranslationKeys.ERROR_OTP_RESEND_WAIT]:
    'Будь ласка, зачекайте {seconds} секунд перед повторним надсиланням OTP',
  [TranslationKeys.ERROR_OTP_INVALID_OR_EXPIRED]:
    'OTP недійсний або прострочений',
  [TranslationKeys.ERROR_TOKEN_INVALID_OR_EXPIRED]:
    'Токен недійсний або прострочений',
  [TranslationKeys.ERROR_MOVIES_FETCH_FAILED]: 'Не вдалось отримати фільми',
  [TranslationKeys.ERROR_MOVIE_NOT_FOUND]: 'Фільм не знайдено',
  [TranslationKeys.ERROR_MOVIE_DETAILS_FETCH_FAILED]:
    'Не вдалось отримати деталі фільму',
  [TranslationKeys.ERROR_TV_SHOW_NOT_FOUND]: 'Серіал не знайдено',
  [TranslationKeys.ERROR_TV_SHOW_DETAILS_FETCH_FAILED]:
    'Не вдалось отримати деталі серіалу',
  [TranslationKeys.ERROR_PERSON_NOT_FOUND]: 'Персону не знайдено',
  [TranslationKeys.ERROR_PERSON_FETCH_FAILED]: 'Не вдалось отримати персону',
  [TranslationKeys.ERROR_SEARCH_FAILED]: 'Помилка пошуку',
  [TranslationKeys.ERROR_USER_NOT_FOUND]: 'Користувача не знайдено',
  [TranslationKeys.ERROR_AI_SERVICE_UNAVAILABLE]:
    'Служба штучного інтелекту тимчасово недоступна. Будь ласка, спробуйте пізніше.',
  [TranslationKeys.ERROR_LIST_FILE_DOWNLOAD_FAILED]:
    'Не вдалось завантажити файл списку. Будь ласка, спробуйте ще раз.',
  [TranslationKeys.ERROR_LIST_FILE_UPLOAD_FAILED]:
    'Не вдалось обробити файл списку. Будь ласка, спробуйте ще раз.',
  [TranslationKeys.ERROR_AI_RESPONSE_PARSE_FAILED]:
    'Не вдалось обробити рекомендації. Будь ласка, спробуйте ще раз.',
  [TranslationKeys.AI_RECOMMENDATIONS_DEFAULT_RESPONSE]:
    'Ось мої рекомендації:',
};
