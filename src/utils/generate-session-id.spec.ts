import { createHash } from 'crypto';

import { generateSessionId } from './generate-session-id';

describe('generateSessionId', () => {
  it('should return a base64 encoded sha256 hash', () => {
    const result = generateSessionId('user-uuid', '127.0.0.1', 'Mozilla/5.0');

    const expected = createHash('sha256')
      .update(
        JSON.stringify({
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          userId: 'user-uuid',
        }),
      )
      .digest('base64');

    expect(result).toBe(expected);
  });

  it('should return the same hash for the same input', () => {
    const first = generateSessionId('user-uuid', '127.0.0.1', 'Mozilla/5.0');
    const second = generateSessionId('user-uuid', '127.0.0.1', 'Mozilla/5.0');

    expect(first).toBe(second);
  });

  it('should return different hashes for different userId', () => {
    const first = generateSessionId('user-uuid-1', '127.0.0.1', 'Mozilla/5.0');
    const second = generateSessionId('user-uuid-2', '127.0.0.1', 'Mozilla/5.0');

    expect(first).not.toBe(second);
  });

  it('should return different hashes for different ip', () => {
    const first = generateSessionId('user-uuid', '127.0.0.1', 'Mozilla/5.0');
    const second = generateSessionId('user-uuid', '192.168.0.1', 'Mozilla/5.0');

    expect(first).not.toBe(second);
  });

  it('should return different hashes for different userAgent', () => {
    const first = generateSessionId('user-uuid', '127.0.0.1', 'Mozilla/5.0');
    const second = generateSessionId('user-uuid', '127.0.0.1', 'Chrome/100.0');

    expect(first).not.toBe(second);
  });
});
