import { randomBytes } from 'crypto';

export const generateResetPasswordToken = () => {
  return randomBytes(32).toString('hex');
};
