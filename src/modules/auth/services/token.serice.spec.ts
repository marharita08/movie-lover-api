import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { jwtConfig } from 'src/config/jwt.config';
import { Session } from 'src/entities';
import { TranslationService } from 'src/modules/translation/translation.service';

import { SessionService } from './session.service';
import { TokenService } from './token.service';

const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const mockSessionService = () => ({
  save: jest.fn(),
  getById: jest.fn(),
});

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: 'session-uuid',
    userId: 'user-uuid',
    refreshToken: 'old-refresh-token',
    ...overrides,
  }) as unknown as Session;

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useFactory: mockJwtService },
        { provide: SessionService, useFactory: mockSessionService },
        {
          provide: jwtConfig.KEY,
          useValue: {
            secret: 'jwt_secret',
            ttl: '30m',
            refreshSecret: 'jwt_refresh_secret',
            refreshTtl: '15d',
          },
        },
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
      ],
    }).compile();

    service = module.get(TokenService);
    jwtService = module.get(JwtService);
    sessionService = module.get(SessionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateTokensPair', () => {
    it('should generate access and refresh tokens and save session', async () => {
      const session = makeSession();

      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      sessionService.save.mockResolvedValue(undefined);

      const result = await service.generateTokensPair(session);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sessionId: session.id },
        { secret: 'jwt_secret', expiresIn: '30m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sessionId: session.id },
        { secret: 'jwt_refresh_secret', expiresIn: '15d' },
      );
      expect(session.refreshToken).toBe('refresh-token');
      expect(sessionService.save).toHaveBeenCalledWith(session);
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should return session if token is valid', async () => {
      const session = makeSession();

      jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
      sessionService.getById.mockResolvedValue(session);

      const result = await service.verifyAccessToken('valid-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'jwt_secret',
      });
      expect(sessionService.getById).toHaveBeenCalledWith('session-uuid');
      expect(result).toBe(session);
    });

    it.each([
      [
        'token is invalid',
        () =>
          jwtService.verify.mockImplementation(() => {
            throw new Error();
          }),
      ],
      ['payload has no sessionId', () => jwtService.verify.mockReturnValue({})],
      [
        'session is not found',
        () => {
          jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
          sessionService.getById.mockResolvedValue(null as never);
        },
      ],
    ])('should throw UnauthorizedException when %s', async (_label, setup) => {
      setup();

      await expect(service.verifyAccessToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('should return session if refresh token is valid and matches', async () => {
      const session = makeSession({ refreshToken: 'refresh-token' });

      jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
      sessionService.getById.mockResolvedValue(session);

      const result = await service.verifyRefreshToken('refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('refresh-token', {
        secret: 'jwt_refresh_secret',
      });
      expect(result).toBe(session);
    });

    it.each([
      [
        'token is invalid',
        () =>
          jwtService.verify.mockImplementation(() => {
            throw new Error();
          }),
      ],
      ['payload has no sessionId', () => jwtService.verify.mockReturnValue({})],
      [
        'session is not found',
        () => {
          jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
          sessionService.getById.mockResolvedValue(null as never);
        },
      ],
      [
        'token does not match session refreshToken',
        () => {
          jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
          sessionService.getById.mockResolvedValue(
            makeSession({ refreshToken: 'different-token' }),
          );
        },
      ],
    ])('should throw UnauthorizedException when %s', async (_label, setup) => {
      setup();

      await expect(service.verifyRefreshToken('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
