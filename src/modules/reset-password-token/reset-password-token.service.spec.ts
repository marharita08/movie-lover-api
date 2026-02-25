import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { ResetPasswordToken } from 'src/entities';
import { HashService } from 'src/modules/hash/hash.service';
import * as generateResetPasswordTokenUtil from 'src/utils/generate-reset-password-token';

import { ResetPasswordTokenService } from './reset-password-token.service';

jest.mock('src/utils/generate-reset-password-token');

const mockResetPasswordTokenRepository = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
});

const mockHashService = () => ({
  hash: jest.fn(),
  compare: jest.fn(),
});

const FIXED_DATE = new Date('2026-02-23T11:00:00.000Z');

const makeToken = (
  overrides: Partial<ResetPasswordToken> = {},
): ResetPasswordToken =>
  ({
    id: 'token-uuid-1',
    tokenHash: 'hashed_token',
    userId: 'user-uuid-1',
    expiresAt: new Date(FIXED_DATE.getTime() + 10 * 60 * 1000),
    ...overrides,
  }) as unknown as ResetPasswordToken;

describe('ResetPasswordTokenService', () => {
  let service: ResetPasswordTokenService;
  let resetPasswordTokenRepository: jest.Mocked<Repository<ResetPasswordToken>>;
  let hashService: jest.Mocked<HashService>;
  let mockedGenerateResetPasswordToken: jest.MockedFunction<
    typeof generateResetPasswordTokenUtil.generateResetPasswordToken
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordTokenService,
        {
          provide: getRepositoryToken(ResetPasswordToken),
          useFactory: mockResetPasswordTokenRepository,
        },
        { provide: HashService, useFactory: mockHashService },
      ],
    }).compile();

    service = module.get(ResetPasswordTokenService);
    resetPasswordTokenRepository = module.get(
      getRepositoryToken(ResetPasswordToken),
    );
    hashService = module.get(HashService);
    mockedGenerateResetPasswordToken = jest.mocked(
      generateResetPasswordTokenUtil.generateResetPasswordToken,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_DATE);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should hash the token and save it, then return the plain token', async () => {
      mockedGenerateResetPasswordToken.mockReturnValue('plain_token');
      hashService.hash.mockResolvedValue('hashed_token');
      resetPasswordTokenRepository.save.mockResolvedValue(makeToken());

      const result = await service.create('user-uuid-1');

      expect(mockedGenerateResetPasswordToken).toHaveBeenCalled();
      expect(hashService.hash).toHaveBeenCalledWith('plain_token');
      expect(resetPasswordTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: 'hashed_token',
          userId: 'user-uuid-1',
          expiresAt: new Date(FIXED_DATE.getTime() + 10 * 60 * 1000),
        }),
      );
      expect(result).toBe('plain_token');
    });

    it('should set expiresAt to exactly 10 minutes in the future', async () => {
      mockedGenerateResetPasswordToken.mockReturnValue('plain_token');
      hashService.hash.mockResolvedValue('hashed_token');
      resetPasswordTokenRepository.save.mockResolvedValue(makeToken());

      await service.create('user-uuid-1');

      const { expiresAt } = resetPasswordTokenRepository.save.mock
        .calls[0][0] as { expiresAt: Date };

      expect(expiresAt).toEqual(
        new Date(FIXED_DATE.getTime() + 10 * 60 * 1000),
      );
    });
  });

  describe('verifyAndDelete', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_DATE);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delete the token when it is valid', async () => {
      const token = makeToken();
      resetPasswordTokenRepository.findOne.mockResolvedValue(token);
      hashService.compare.mockResolvedValue(true);

      await service.verifyAndDelete('user-uuid-1', 'plain_token');

      expect(resetPasswordTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-uuid-1',
          expiresAt: MoreThan(FIXED_DATE),
        },
      });
      expect(hashService.compare).toHaveBeenCalledWith(
        'plain_token',
        'hashed_token',
      );
      expect(resetPasswordTokenRepository.delete).toHaveBeenCalledWith(
        token.id,
      );
    });

    it('should throw UnauthorizedException when no token record is found', async () => {
      resetPasswordTokenRepository.findOne.mockResolvedValue(null as never);

      await expect(
        service.verifyAndDelete('user-uuid-1', 'plain_token'),
      ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));

      expect(hashService.compare).not.toHaveBeenCalled();
      expect(resetPasswordTokenRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the token hash does not match', async () => {
      const token = makeToken();
      resetPasswordTokenRepository.findOne.mockResolvedValue(token);
      hashService.compare.mockResolvedValue(false);

      await expect(
        service.verifyAndDelete('user-uuid-1', 'wrong_token'),
      ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));

      expect(resetPasswordTokenRepository.delete).not.toHaveBeenCalled();
    });
  });
});
