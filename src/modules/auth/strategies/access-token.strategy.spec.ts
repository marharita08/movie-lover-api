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
    });

    it('should throw UnauthorizedException if session is not found or has no user', async () => {
      sessionService.getById.mockResolvedValueOnce(null as never);
      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);

      sessionService.getById.mockResolvedValueOnce({
        id: 'session-uuid',
        user: null,
      } as never);
      await expect(
        strategy.validate({ sessionId: 'session-uuid' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user without private fields', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        password: 'hashed',
      };
      const excludedUser = { id: 'user-uuid', email: 'test@example.com' };

      sessionService.getById.mockResolvedValue({
        id: 'session-uuid',
        user: mockUser,
      } as never);
      userService.excludePrivateFields.mockReturnValue(excludedUser as never);

      const result = await strategy.validate({ sessionId: 'session-uuid' });

      expect(userService.excludePrivateFields).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(excludedUser);
      expect(result).not.toHaveProperty('password');
    });
  });
});
