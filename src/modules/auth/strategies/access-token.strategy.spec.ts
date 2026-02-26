import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { UserService } from 'src/modules/user/user.service';

import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { SessionService } from '../services';

import { AccessTokenStrategy } from './access-token.strategy';

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue('test_secret'),
});

const mockSessionService = () => ({
  getById: jest.fn(),
});

const mockUserService = () => ({
  excludePrivateFields: jest.fn(),
});

describe('AccessTokenStrategy', () => {
  let strategy: AccessTokenStrategy;
  let sessionService: jest.Mocked<SessionService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenStrategy,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: SessionService, useFactory: mockSessionService },
        { provide: UserService, useFactory: mockUserService },
      ],
    }).compile();

    strategy = module.get(AccessTokenStrategy);
    sessionService = module.get(SessionService);
    userService = module.get(UserService);
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
          { provide: UserService, useFactory: mockUserService },
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

      await expect(strategy.validate({} as JwtPayloadDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if session is not found', async () => {
      sessionService.getById.mockResolvedValue(null as never);

      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionService.getById).toHaveBeenCalledWith('session-uuid');
    });

    it('should throw UnauthorizedException if session has no user', async () => {
      sessionService.getById.mockResolvedValue({
        id: 'session-uuid',
        user: null,
      } as never);

      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if session.user is undefined', async () => {
      sessionService.getById.mockResolvedValue({
        id: 'session-uuid',
      } as never);

      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return spread user fields and session without user', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        password: 'hashed',
      };
      const mockSession = {
        id: 'session-uuid',
        token: 'token',
        user: mockUser,
      };
      const excludedUser = { id: 'user-uuid', email: 'test@example.com' };

      sessionService.getById.mockResolvedValue(mockSession as never);
      userService.excludePrivateFields.mockReturnValue(excludedUser as never);

      const result = await strategy.validate({ sessionId: 'session-uuid' });

      expect(sessionService.getById).toHaveBeenCalledWith('session-uuid');
      expect(userService.excludePrivateFields).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        session: { id: 'session-uuid', token: 'token' },
        id: 'user-uuid',
        email: 'test@example.com',
      });
      expect(result).not.toHaveProperty('session.user');
      expect(result).not.toHaveProperty('password');
    });
  });
});
