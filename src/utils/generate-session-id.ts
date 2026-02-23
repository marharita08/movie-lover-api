import { createHash } from 'crypto';

export const generateSessionId = (
  userId: string,
  ip: string,
  userAgent: string,
) => {
  return createHash('sha256')
    .update(JSON.stringify({ ip, userAgent, userId }))
    .digest('base64');
};
