import { Injectable, NotFoundException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtService } from '@nestjs/jwt';

import { ConfigService } from '@nestjs/config';
import { SessionService } from '../services';

type JwtPayload = { sessionId: string };

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT secret is missing in environment');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sessionId) {
      throw new NotFoundException('User not found');
    }

    const session = await this.sessionService.getById(payload.sessionId);

    if (!session?.user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...payload,
      session,
      ...session.user,
    };
  }
}
