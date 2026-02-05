import { OtpPurpose } from 'src/entities';

export const OtpPurposeToEmailSubject = {
  [OtpPurpose.EMAIL_VERIFICATION]: 'Email Verification',
  [OtpPurpose.RESET_PASSWORD]: 'Reset Password',
} as const;
