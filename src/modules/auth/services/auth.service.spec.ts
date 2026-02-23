import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { OtpPurpose } from 'src/entities';
import { EmailService } from 'src/modules/email/email.service';
import { HashService } from 'src/modules/hash/hash.service';
import { OtpService } from 'src/modules/otp/otp.service';
import { ResetPasswordTokenService } from 'src/modules/reset-password-token/reset-password-token.service';
import { UserService } from 'src/modules/user/user.service';
import * as generateSessionIdUtil from 'src/utils/generate-session-id';

import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

jest.mock('src/utils/generate-session-id');

const mockUserService = () => ({
  getByEmail: jest.fn(),
  getByEmailOrThrow: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const mockHashService = () => ({
  hash: jest.fn(),
  compare: jest.fn(),
});

const mockSessionService = () => ({
  getOrCreate: jest.fn(),
  deleteAllSessions: jest.fn(),
});

const mockTokenService = () => ({
  generateTokensPair: jest.fn(),
  verifyRefreshToken: jest.fn(),
});

const mockOtpService = () => ({
  create: jest.fn(),
  verifyAndDelete: jest.fn(),
});

const mockEmailService = () => ({
  sendEmail: jest.fn(),
});

const mockResetPasswordTokenService = () => ({
  create: jest.fn(),
  verifyAndDelete: jest.fn(),
});

const makeUser = (overrides = {}) => ({
  id: 'user-uuid',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  name: 'Test User',
  isEmailVerified: false,
  ...overrides,
});

const makeSession = (overrides = {}) => ({
  id: 'session-uuid',
  userId: 'user-uuid',
  refreshToken: 'refresh-token',
  ...overrides,
});

const makeTokensPair = () => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
});

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let hashService: jest.Mocked<HashService>;
  let sessionService: jest.Mocked<SessionService>;
  let tokenService: jest.Mocked<TokenService>;
  let otpService: jest.Mocked<OtpService>;
  let emailService: jest.Mocked<EmailService>;
  let resetPasswordTokenService: jest.Mocked<ResetPasswordTokenService>;
  let mockedGenerateSessionId: jest.MockedFunction<
    typeof generateSessionIdUtil.generateSessionId
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useFactory: mockUserService },
        { provide: HashService, useFactory: mockHashService },
        { provide: SessionService, useFactory: mockSessionService },
        { provide: TokenService, useFactory: mockTokenService },
        { provide: OtpService, useFactory: mockOtpService },
        { provide: EmailService, useFactory: mockEmailService },
        {
          provide: ResetPasswordTokenService,
          useFactory: mockResetPasswordTokenService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userService = module.get(UserService);
    hashService = module.get(HashService);
    sessionService = module.get(SessionService);
    tokenService = module.get(TokenService);
    otpService = module.get(OtpService);
    emailService = module.get(EmailService);
    resetPasswordTokenService = module.get(ResetPasswordTokenService);
    mockedGenerateSessionId = jest.mocked(
      generateSessionIdUtil.generateSessionId,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('signUp', () => {
    it('should throw ConflictException if email already taken', async () => {
      userService.getByEmail.mockResolvedValue(makeUser() as never);

      await expect(
        service.signUp({
          email: 'test@example.com',
          password: 'password',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);

      expect(hashService.hash).not.toHaveBeenCalled();
    });

    it('should create user, send verification email and return message', async () => {
      userService.getByEmail.mockResolvedValue(null);
      hashService.hash.mockResolvedValue('hashed_password');
      userService.create.mockResolvedValue(makeUser() as never);
      otpService.create.mockResolvedValue(123456);
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.signUp({
        email: 'test@example.com',
        password: 'password',
        name: 'Test User',
      });

      expect(hashService.hash).toHaveBeenCalledWith('password');
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          passwordHash: 'hashed_password',
          name: 'Test User',
        }),
      );
      expect(otpService.create).toHaveBeenCalledWith(
        'test@example.com',
        OtpPurpose.EMAIL_VERIFICATION,
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Movie Lover - Email Verification',
        expect.any(String),
      );
      expect(result).toEqual({
        message: 'We sent you an email with a verification code',
      });
    });
  });

  describe('verifyEmailAndLogin', () => {
    it('should verify email, create session and return tokens', async () => {
      const user = makeUser();
      const session = makeSession();
      const tokens = makeTokensPair();
      userService.getByEmailOrThrow.mockResolvedValue(user as never);
      otpService.verifyAndDelete.mockResolvedValue(undefined);
      userService.update.mockResolvedValue(user as never);
      mockedGenerateSessionId.mockReturnValue('session-uuid');
      sessionService.getOrCreate.mockResolvedValue(session as never);
      tokenService.generateTokensPair.mockResolvedValue(tokens);

      const result = await service.verifyEmailAndLogin(
        { email: 'test@example.com', code: 123456 },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(otpService.verifyAndDelete).toHaveBeenCalledWith(
        'test@example.com',
        123456,
        OtpPurpose.EMAIL_VERIFICATION,
      );
      expect(userService.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ isEmailVerified: true }),
      );
      expect(mockedGenerateSessionId).toHaveBeenCalledWith(
        user.id,
        '127.0.0.1',
        'Mozilla/5.0',
      );
      expect(sessionService.getOrCreate).toHaveBeenCalledWith(
        'session-uuid',
        user,
      );
      expect(result).toEqual(tokens);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      userService.getByEmail.mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'password' },
          '127.0.0.1',
          'Mozilla/5.0',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(hashService.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      userService.getByEmail.mockResolvedValue(makeUser() as never);
      hashService.compare.mockResolvedValue(false);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'wrong_password' },
          '127.0.0.1',
          'Mozilla/5.0',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionService.getOrCreate).not.toHaveBeenCalled();
    });

    it('should update lastLoginAt, create session and return tokens', async () => {
      const user = makeUser();
      const session = makeSession();
      const tokens = makeTokensPair();
      userService.getByEmail.mockResolvedValue(user as never);
      hashService.compare.mockResolvedValue(true);
      userService.update.mockResolvedValue(user as never);
      mockedGenerateSessionId.mockReturnValue('session-uuid');
      sessionService.getOrCreate.mockResolvedValue(session as never);
      tokenService.generateTokensPair.mockResolvedValue(tokens);

      const result = await service.login(
        { email: 'test@example.com', password: 'password' },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(userService.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ lastLoginAt: expect.any(Date) as Date }),
      );
      expect(sessionService.getOrCreate).toHaveBeenCalledWith(
        'session-uuid',
        user,
      );
      expect(result).toEqual(tokens);
    });
  });

  describe('refresh', () => {
    it('should verify refresh token and return new tokens pair', async () => {
      const session = makeSession();
      const tokens = makeTokensPair();
      tokenService.verifyRefreshToken.mockResolvedValue(session as never);
      tokenService.generateTokensPair.mockResolvedValue(tokens);

      const result = await service.refresh('refresh-token');

      expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );
      expect(tokenService.generateTokensPair).toHaveBeenCalledWith(session);
      expect(result).toEqual(tokens);
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const user = makeUser();
      userService.getById.mockResolvedValue(user as never);

      const result = await service.getUser('user-uuid');

      expect(userService.getById).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual(user);
    });
  });

  describe('sendOtp', () => {
    it('should create otp, send email and return message', async () => {
      otpService.create.mockResolvedValue(123456);
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.sendOtp({
        email: 'test@example.com',
        purpose: OtpPurpose.EMAIL_VERIFICATION,
      });

      expect(otpService.create).toHaveBeenCalledWith(
        'test@example.com',
        OtpPurpose.EMAIL_VERIFICATION,
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(result).toEqual({
        message: 'We sent you an email with a verification code',
      });
    });
  });

  describe('updateUser', () => {
    it('should call userService.update with correct arguments', async () => {
      const user = makeUser();
      userService.update.mockResolvedValue(user as never);

      const result = await service.updateUser('user-uuid', {
        name: 'New Name',
      });

      expect(userService.update).toHaveBeenCalledWith('user-uuid', {
        name: 'New Name',
      });
      expect(result).toEqual(user);
    });
  });

  describe('deleteUser', () => {
    it('should call userService.delete with correct id', async () => {
      userService.delete.mockResolvedValue(undefined);

      await service.deleteUser('user-uuid');

      expect(userService.delete).toHaveBeenCalledWith('user-uuid');
    });
  });

  describe('forgotPassword', () => {
    it('should throw if user is not found', async () => {
      userService.getByEmailOrThrow.mockRejectedValue(new Error('Not found'));

      await expect(
        service.forgotPassword({ email: 'test@example.com' }),
      ).rejects.toThrow();

      expect(otpService.create).not.toHaveBeenCalled();
    });

    it('should create otp, send email and return message', async () => {
      userService.getByEmailOrThrow.mockResolvedValue(makeUser() as never);
      otpService.create.mockResolvedValue(123456);
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(otpService.create).toHaveBeenCalledWith(
        'test@example.com',
        OtpPurpose.RESET_PASSWORD,
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Movie Lover - Password Reset',
        expect.any(String),
      );
      expect(result).toEqual({
        message: 'We sent you an email with a reset code',
      });
    });
  });

  describe('verifyResetPasswordOtp', () => {
    it('should verify otp, create reset token and return it', async () => {
      const user = makeUser();
      userService.getByEmailOrThrow.mockResolvedValue(user as never);
      otpService.verifyAndDelete.mockResolvedValue(undefined);
      resetPasswordTokenService.create.mockResolvedValue('reset-token');

      const result = await service.verifyResetPasswordOtp({
        email: 'test@example.com',
        code: 123456,
      });

      expect(otpService.verifyAndDelete).toHaveBeenCalledWith(
        'test@example.com',
        123456,
        OtpPurpose.RESET_PASSWORD,
      );
      expect(resetPasswordTokenService.create).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ token: 'reset-token' });
    });
  });

  describe('resetPassword', () => {
    it('should verify token, update password and delete all sessions', async () => {
      const user = makeUser();
      userService.getByEmailOrThrow.mockResolvedValue(user as never);
      resetPasswordTokenService.verifyAndDelete.mockResolvedValue(undefined);
      hashService.hash.mockResolvedValue('new_hashed_password');
      userService.update.mockResolvedValue(user as never);
      sessionService.deleteAllSessions.mockResolvedValue(undefined);

      await service.resetPassword({
        email: 'test@example.com',
        token: 'reset-token',
        password: 'new_password',
      });

      expect(resetPasswordTokenService.verifyAndDelete).toHaveBeenCalledWith(
        user.id,
        'reset-token',
      );
      expect(hashService.hash).toHaveBeenCalledWith('new_password');
      expect(userService.update).toHaveBeenCalledWith(user.id, {
        passwordHash: 'new_hashed_password',
      });
      expect(sessionService.deleteAllSessions).toHaveBeenCalledWith(user.id);
    });
  });

  describe('changePassword', () => {
    it('should hash new password and update user', async () => {
      const user = makeUser();
      userService.getByEmailOrThrow.mockResolvedValue(user as never);
      hashService.hash.mockResolvedValue('new_hashed_password');
      userService.update.mockResolvedValue(user as never);

      await service.changePassword('test@example.com', {
        password: 'new_password',
      });

      expect(hashService.hash).toHaveBeenCalledWith('new_password');
      expect(userService.update).toHaveBeenCalledWith(user.id, {
        passwordHash: 'new_hashed_password',
      });
    });
  });
});
