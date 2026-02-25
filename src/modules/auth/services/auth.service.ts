import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { OtpPurpose } from 'src/entities';
import { EmailService } from 'src/modules/email/email.service';
import { HashService } from 'src/modules/hash/hash.service';
import { OtpService } from 'src/modules/otp/otp.service';
import { ResetPasswordTokenService } from 'src/modules/reset-password-token/reset-password-token.service';
import { UserDto } from 'src/modules/user/dto';
import { UserService } from 'src/modules/user/user.service';
import { generateSessionId } from 'src/utils';

import { getOtpEmailMessage, OtpPurposeToEmailSubject } from '../const';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SendOtpDto,
  SignUpDto,
  UpdateUserDto,
  VerifyEmailDto,
  VerifyResetPasswordOtpDto,
} from '../dto';

import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly hashService: HashService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly resetPasswordTokenService: ResetPasswordTokenService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const existingUser = await this.userService.getByEmail(signUpDto.email);
    if (existingUser) {
      throw new ConflictException('Email already taken');
    }

    const passwordHash = await this.hashService.hash(signUpDto.password);

    const user = await this.userService.create({
      name: signUpDto.name,
      email: signUpDto.email,
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      passwordHash,
    });

    const code = await this.otpService.create(
      user.email,
      OtpPurpose.EMAIL_VERIFICATION,
    );

    await this.emailService.sendEmail(
      user.email,
      'Movie Lover - Email Verification',
      getOtpEmailMessage(code),
    );

    return { message: 'We sent you an email with a verification code' };
  }

  async verifyEmailAndLogin(
    verifyEmailDto: VerifyEmailDto,
    ip: string,
    userAgent: string,
  ) {
    const { email, code } = verifyEmailDto;
    const user = await this.userService.getByEmailOrThrow(email);

    await this.otpService.verifyAndDelete(
      email,
      code,
      OtpPurpose.EMAIL_VERIFICATION,
    );
    await this.userService.update(user.id, {
      isEmailVerified: true,
      lastLoginAt: new Date(),
    });

    const sessionId = generateSessionId(user.id, ip, userAgent);
    const session = await this.sessionService.getOrCreate(sessionId, user);

    return await this.tokenService.generateTokensPair(session);
  }

  async login(
    loginDto: LoginDto,
    ip: string,
    userAgent: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginDto;
    const user = await this.userService.getByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.hashService.compare(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userService.update(user.id, {
      lastLoginAt: new Date(),
    });

    const sessionId = generateSessionId(user.id, ip, userAgent);
    const session = await this.sessionService.getOrCreate(sessionId, user);

    return await this.tokenService.generateTokensPair(session);
  }

  public async refresh(refreshToken: string) {
    const session = await this.tokenService.verifyRefreshToken(refreshToken);

    return this.tokenService.generateTokensPair(session);
  }

  public async getUser(userId: string): Promise<UserDto> {
    return this.userService.getById(userId);
  }

  public async sendOtp(sendOtpDto: SendOtpDto) {
    const { email, purpose } = sendOtpDto;
    const code = await this.otpService.create(email, purpose);

    await this.emailService.sendEmail(
      email,
      `Movie Lover - ${OtpPurposeToEmailSubject[purpose]}`,
      getOtpEmailMessage(code),
    );

    return { message: 'We sent you an email with a verification code' };
  }

  public async updateUser(id: string, updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  public async deleteUser(id: string) {
    return this.userService.delete(id);
  }

  public async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    await this.userService.getByEmailOrThrow(email);
    const code = await this.otpService.create(email, OtpPurpose.RESET_PASSWORD);

    await this.emailService.sendEmail(
      email,
      'Movie Lover - Password Reset',
      getOtpEmailMessage(code),
    );

    return { message: 'We sent you an email with a reset code' };
  }

  public async verifyResetPasswordOtp(
    verifyResetPasswordOtpDto: VerifyResetPasswordOtpDto,
  ) {
    const { email, code } = verifyResetPasswordOtpDto;
    const user = await this.userService.getByEmailOrThrow(email);
    await this.otpService.verifyAndDelete(
      email,
      code,
      OtpPurpose.RESET_PASSWORD,
    );
    const token = await this.resetPasswordTokenService.create(user.id);

    return { token };
  }

  public async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, token, password } = resetPasswordDto;
    const user = await this.userService.getByEmailOrThrow(email);
    await this.resetPasswordTokenService.verifyAndDelete(user.id, token);

    const passwordHash = await this.hashService.hash(password);
    await this.userService.update(user.id, { passwordHash });
    await this.sessionService.deleteAllSessions(user.id);
  }

  public async changePassword(
    email: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    const { password } = changePasswordDto;
    const user = await this.userService.getByEmailOrThrow(email);
    const passwordHash = await this.hashService.hash(password);
    await this.userService.update(user.id, { passwordHash });
  }
}
