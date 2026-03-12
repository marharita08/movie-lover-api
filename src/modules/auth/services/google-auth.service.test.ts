import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Client } from 'google-auth-library';

import { GoogleAuthService } from './google-auth.service';

jest.mock('google-auth-library');

const mockGetToken = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockGetPayload = jest.fn();

(OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
  getToken: mockGetToken,
  verifyIdToken: mockVerifyIdToken,
}));

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GOOGLE_CLIENT_ID: 'mock-client-id',
        GOOGLE_CLIENT_SECRET: 'mock-client-secret',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize OAuth2Client with config values', () => {
      expect(OAuth2Client).toHaveBeenCalledWith(
        'mock-client-id',
        'mock-client-secret',
      );
    });

    it('should read GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from config', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('GOOGLE_CLIENT_ID');
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'GOOGLE_CLIENT_SECRET',
      );
    });
  });

  describe('verifyGoogleToken', () => {
    const mockCode = 'mock-auth-code';
    const mockIdToken = 'mock-id-token';

    const mockPayload = {
      sub: 'google-user-id-123',
      email: 'user@example.com',
      name: 'John Doe',
    };

    beforeEach(() => {
      mockGetToken.mockResolvedValue({ tokens: { id_token: mockIdToken } });
      mockGetPayload.mockReturnValue(mockPayload);
      mockVerifyIdToken.mockResolvedValue({ getPayload: mockGetPayload });
    });

    it('should return user data on successful verification', async () => {
      const result = await service.verifyGoogleToken(mockCode);

      expect(result).toEqual({
        googleId: 'google-user-id-123',
        email: 'user@example.com',
        name: 'John Doe',
      });
    });

    it('should call getToken with correct params', async () => {
      await service.verifyGoogleToken(mockCode);

      expect(mockGetToken).toHaveBeenCalledWith({
        code: mockCode,
        redirect_uri: 'postmessage',
      });
    });

    it('should call verifyIdToken with correct params', async () => {
      await service.verifyGoogleToken(mockCode);

      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: mockIdToken,
        audience: 'mock-client-id',
      });
    });

    it('should throw UnauthorizedException when payload has no sub', async () => {
      mockGetPayload.mockReturnValue({ email: 'user@example.com', sub: null });

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when payload has no email', async () => {
      mockGetPayload.mockReturnValue({ sub: 'google-id', email: null });

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when payload is null', async () => {
      mockGetPayload.mockReturnValue(null);

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when getToken fails', async () => {
      mockGetToken.mockRejectedValue(new Error('Network error'));

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when verifyIdToken fails', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with correct message', async () => {
      mockGetToken.mockRejectedValue(new Error('fail'));

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        'Authorization failed',
      );
    });

    it('should handle payload with undefined name', async () => {
      mockGetPayload.mockReturnValue({
        sub: 'google-user-id-123',
        email: 'user@example.com',
        name: undefined,
      });

      const result = await service.verifyGoogleToken(mockCode);

      expect(result).toEqual({
        googleId: 'google-user-id-123',
        email: 'user@example.com',
        name: undefined,
      });
    });
  });
});
