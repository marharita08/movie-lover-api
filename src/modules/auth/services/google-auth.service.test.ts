import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Client } from 'google-auth-library';

import { googleOAuthConfig } from 'src/config/google-oauth.config';
import { TranslationService } from 'src/modules/translation/translation.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: googleOAuthConfig.KEY,
          useValue: {
            clientId: 'mock-client-id',
            clientSecret: 'mock-client-secret',
          },
        },
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
  });

  describe('constructor', () => {
    it('should initialize OAuth2Client with config values', () => {
      expect(OAuth2Client).toHaveBeenCalledWith(
        'mock-client-id',
        'mock-client-secret',
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

      expect(mockGetToken).toHaveBeenCalledWith({
        code: mockCode,
        redirect_uri: 'postmessage',
      });
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: mockIdToken,
        audience: 'mock-client-id',
      });
      expect(result).toEqual({
        googleId: 'google-user-id-123',
        email: 'user@example.com',
        name: 'John Doe',
      });
    });

    it('should handle payload with undefined name', async () => {
      mockGetPayload.mockReturnValue({ ...mockPayload, name: undefined });

      const result = await service.verifyGoogleToken(mockCode);

      expect(result.name).toBeUndefined();
    });

    it.each([
      ['payload is null', null],
      ['sub is missing', { email: 'user@example.com', sub: null }],
      ['email is missing', { sub: 'google-id', email: null }],
    ])(
      'should throw UnauthorizedException when %s',
      async (_label, payload) => {
        mockGetPayload.mockReturnValue(payload);

        await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
          UnauthorizedException,
        );
      },
    );

    it.each([
      [
        'getToken fails',
        () => mockGetToken.mockRejectedValue(new Error('Network error')),
      ],
      [
        'verifyIdToken fails',
        () => mockVerifyIdToken.mockRejectedValue(new Error('Invalid token')),
      ],
    ])('should throw UnauthorizedException when %s', async (_label, setup) => {
      setup();

      await expect(service.verifyGoogleToken(mockCode)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
