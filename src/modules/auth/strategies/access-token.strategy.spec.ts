import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { SessionService } from '../services';

import { AccessTokenStrategy } from './access-token.strategy';

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue('test_secret'),
});

const mockSessionService = () => ({
  getById: jest.fn(),
});

describe('AccessTokenStrategy', () => {
  let strategy: AccessTokenStrategy;
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenStrategy,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: SessionService, useFactory: mockSessionService },
      ],
    }).compile();

    strategy = module.get(AccessTokenStrategy);
    sessionService = module.get(SessionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('should throw if JWT_SECRET is missing', async () => {
      const module = Test.createTestingModule({
        providers: [
          AccessTokenStrategy,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: SessionService, useFactory: mockSessionService },
        ],
      });

      await expect(module.compile()).rejects.toThrow(
        'JWT secret is missing in environment',
      );
    });
  });

  describe('validate', () => {
    it('should throw UnauthorizedException if sessionId is missing in payload', async () => {
      await expect(
        strategy.validate({ sessionId: '' } as JwtPayloadDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if session is not found', async () => {
      sessionService.getById.mockResolvedValue(null as never);

      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if session has no user', async () => {
      sessionService.getById.mockResolvedValue({ user: null } as never);

      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return spread user fields and session without user', async () => {
      const mockUser = { id: 'user-uuid', email: 'test@example.com' };
      const mockSession = {
        id: 'session-uuid',
        token: 'token',
        user: mockUser,
      };
      sessionService.getById.mockResolvedValue(mockSession as never);

      const result = await strategy.validate({ sessionId: 'session-uuid' });

      expect(result).toEqual({
        session: { id: 'session-uuid', token: 'token' },
        id: 'user-uuid',
        email: 'test@example.com',
      });
      expect(result).not.toHaveProperty('session.user');
    });
  });
});
