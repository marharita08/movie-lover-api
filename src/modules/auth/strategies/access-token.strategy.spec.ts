import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { jwtConfig } from 'src/config';
import { UserService } from 'src/modules/user/user.service';

import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { SessionService } from '../services';

import { AccessTokenStrategy } from './access-token.strategy';

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
        {
          provide: jwtConfig.KEY,
          useValue: {
            secret: 'test_secret',
            ttl: '30m',
            refreshSecret: 'refresh_secret',
            refreshTtl: '15d',
          },
        },
        { provide: SessionService, useFactory: mockSessionService },
        { provide: UserService, useFactory: mockUserService },
      ],
    }).compile();

    strategy = module.get(AccessTokenStrategy);
    sessionService = module.get(SessionService);
    userService = module.get(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    it('should throw UnauthorizedException if sessionId is missing in payload', async () => {
      await expect(
        strategy.validate({ sessionId: '' } as JwtPayloadDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it.each([
      ['session is not found', null],
      ['session has no user', { id: 'session-uuid', user: null }],
    ])(
      'should throw UnauthorizedException when %s',
      async (_label, sessionValue) => {
        sessionService.getById.mockResolvedValue(sessionValue as never);

        await expect(
          strategy.validate({ sessionId: 'session-uuid' }),
        ).rejects.toThrow(UnauthorizedException);
      },
    );

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
    });
  });
});
