import { randomBytes } from 'crypto';

import { generateResetPasswordToken } from './generate-reset-password-token';

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

const mockedRandomBytes = randomBytes as jest.MockedFunction<
  typeof randomBytes
>;

describe('generateResetPasswordToken', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return a hex string from random bytes', () => {
    mockedRandomBytes.mockReturnValue(Buffer.from('a'.repeat(32)) as never);

    const result = generateResetPasswordToken();

    expect(mockedRandomBytes).toHaveBeenCalledWith(32);
    expect(result).toBe(Buffer.from('a'.repeat(32)).toString('hex'));
  });

  it('should return a string of 64 characters', () => {
    mockedRandomBytes.mockReturnValue(randomBytes(32) as never);

    const result = generateResetPasswordToken();

    expect(result).toHaveLength(64);
  });

  it('should return different tokens on each call', () => {
    mockedRandomBytes
      .mockReturnValueOnce(Buffer.from('a'.repeat(32)) as never)
      .mockReturnValueOnce(Buffer.from('b'.repeat(32)) as never);

    const first = generateResetPasswordToken();
    const second = generateResetPasswordToken();

    expect(first).not.toBe(second);
  });
});
