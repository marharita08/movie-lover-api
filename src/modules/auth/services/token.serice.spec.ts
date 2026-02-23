import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { Session } from 'src/entities';

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

const mockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'jwt_secret',
      JWT_TTL: '30m',
      JWT_REFRESH_SECRET: 'jwt_refresh_secret',
      JWT_REFRESH_TTL: '15d',
    };
    return config[key];
  }),
});

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: 'session-uuid',
    userId: 'user-uuid',
    refreshToken: 'old-refresh-token',
    save: jest.fn(),
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
        { provide: ConfigService, useFactory: mockConfigService },
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

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
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

    it('should use default TTL values if config returns undefined', async () => {
      const session = makeSession();
      jwtService.sign.mockReturnValue('token');
      sessionService.save.mockResolvedValue(undefined);

      const configGet = jest.fn().mockReturnValue(undefined);
      const moduleWithoutTtl = await Test.createTestingModule({
        providers: [
          TokenService,
          { provide: JwtService, useFactory: mockJwtService },
          { provide: SessionService, useFactory: mockSessionService },
          { provide: ConfigService, useValue: { get: configGet } },
        ],
      }).compile();

      const serviceWithoutTtl = moduleWithoutTtl.get(TokenService);
      const jwtWithoutTtl =
        moduleWithoutTtl.get<jest.Mocked<JwtService>>(JwtService);
      jwtWithoutTtl.sign.mockReturnValue('token');
      moduleWithoutTtl
        .get<jest.Mocked<SessionService>>(SessionService)
        .save.mockResolvedValue(undefined);

      await serviceWithoutTtl.generateTokensPair(session);

      expect(jwtWithoutTtl.sign).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({ expiresIn: '30m' }),
      );
      expect(jwtWithoutTtl.sign).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ expiresIn: '15d' }),
      );
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

    it('should throw UnauthorizedException if token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.verifyAccessToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if payload has no sessionId', async () => {
      jwtService.verify.mockReturnValue({});

      await expect(service.verifyAccessToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if session is not found', async () => {
      jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
      sessionService.getById.mockResolvedValue(null as never);

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

    it('should throw UnauthorizedException if token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.verifyRefreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if payload has no sessionId', async () => {
      jwtService.verify.mockReturnValue({});

      await expect(service.verifyRefreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if session is not found', async () => {
      jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
      sessionService.getById.mockResolvedValue(null as never);

      await expect(service.verifyRefreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token does not match session refreshToken', async () => {
      const session = makeSession({ refreshToken: 'different-token' });
      jwtService.verify.mockReturnValue({ sessionId: 'session-uuid' });
      sessionService.getById.mockResolvedValue(session);

      await expect(service.verifyRefreshToken('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
