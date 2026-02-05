import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserDto, UserService } from '../../user';
import { SignUpDto } from '../dto/sign-up.dto';
import { HashService } from './hash.service';
import { createHash } from 'crypto';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { OtpService } from 'src/modules/otp/otp.service';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { EmailService } from 'src/modules/email/email.service';
import { OtpPurpose } from 'src/entities';
import { getOtpEmailMessage } from '../const/otp-email-message';
import { OtpPurposeToEmailSubject } from '../const/otp-purpose-to-email-subject';
import { SendOtpDto } from '../dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly hashService: HashService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  public generateSessionId(userId: string, ip: string, userAgent: string) {
    return createHash('sha256')
      .update(JSON.stringify({ ip, userAgent, userId }))
      .digest('base64');
  }

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

    const sessionId = this.generateSessionId(user.id, ip, userAgent);
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

    const sessionId = this.generateSessionId(user.id, ip, userAgent);
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
}
