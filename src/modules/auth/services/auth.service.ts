import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../../user';
import { SignUpDto } from '../dto/sign-up.dto';
import { HashService } from './hash.service';
import { createHash } from 'crypto';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { OtpService } from 'src/modules/otp/otp.service';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { EmailService } from 'src/modules/email/email.service';

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

    const code = await this.otpService.create(user.email);

    await this.emailService.sendEmail(
      user.email,
      'Movie Lover - Email Verification',
      `Your verification code is ${code}. This code will expire in 10 minutes.`,
      `Your verification code is ${code}. This code will expire in 10 minutes.`,
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

    await this.otpService.verifyAndDelete(email, code);
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
}
