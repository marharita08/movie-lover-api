import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../../user';
import { SignUpDto } from '../dto/sign-up.dto';
import { HashService } from './hash.service';
import { createHash } from 'crypto';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly hashService: HashService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
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

    const passwordHash = this.hashService.hash(signUpDto.password);

    const user = await this.userService.create({
      name: signUpDto.name,
      email: signUpDto.email,
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      passwordHash,
    });

    return user;
  }

  async login(
    email: string,
    password: string,
    ip: string,
    userAgent: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userService.getByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = this.hashService.compare(
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
}
