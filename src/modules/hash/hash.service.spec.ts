import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { HashService } from './hash.service';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('HashService', () => {
  let service: HashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HashService],
    }).compile();

    service = module.get(HashService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('hash', () => {
    it('should return a hashed string', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed_value' as never);

      const result = await service.hash('my_password');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('my_password', 12);
      expect(result).toBe('hashed_value');
    });
  });

  describe('compare', () => {
    it('should return true when string matches the hash', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.compare('my_password', 'hashed_value');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'my_password',
        'hashed_value',
      );
      expect(result).toBe(true);
    });

    it('should return false when string does not match the hash', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.compare('wrong_password', 'hashed_value');

      expect(result).toBe(false);
    });
  });
});
