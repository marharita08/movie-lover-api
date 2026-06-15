import { TranslationKeys } from 'src/const/translations/keys';
import { OtpPurpose } from 'src/entities';

export const OtpPurposeToEmailSubject = {
  [OtpPurpose.EMAIL_VERIFICATION]:
    TranslationKeys.OTP_EMAIL_SUBJECT_EMAIL_VERIFICATION,
  [OtpPurpose.RESET_PASSWORD]: TranslationKeys.OTP_EMAIL_SUBJECT_RESET_PASSWORD,
} as const;
