import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Session } from 'src/entities';
import type { StringValue } from 'ms';

import { SessionService } from './session.service';

type TokenPayload = {
  sessionId: string;
};

@Injectable()
export class TokenService {
  private INVALID_TOKEN_MESSAGE = 'Your token has expired or is not valid';

  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
    private configService: ConfigService,
  ) {}

  public async generateTokensPair(session: Session) {
    const payload: TokenPayload = { sessionId: session.id };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn:
        (this.configService.get<string>('JWT_TTL') as StringValue) ?? '30m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        (this.configService.get<string>('JWT_REFRESH_TTL') as StringValue) ??
        '15d',
    });

    session.refreshToken = refreshToken;
    await this.sessionService.save(session);

    return { accessToken, refreshToken };
  }

  public async verifyAccessToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as TokenPayload;

      if (!payload.sessionId) {
        throw new UnauthorizedException(this.INVALID_TOKEN_MESSAGE);
      }

      const session = await this.sessionService.getById(payload.sessionId);
      if (!session) {
        throw new UnauthorizedException(this.INVALID_TOKEN_MESSAGE);
      }

      return session;
    } catch {
      throw new UnauthorizedException(this.INVALID_TOKEN_MESSAGE);
    }
  }

  public async verifyRefreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }) as TokenPayload;

      if (!payload.sessionId) {
        throw new UnauthorizedException(this.INVALID_TOKEN_MESSAGE);
      }

      const session = await this.sessionService.getById(payload.sessionId);

      if (!session || token !== session.refreshToken) {
        throw new UnauthorizedException(this.INVALID_TOKEN_MESSAGE);
      }

      return session;
    } catch (e) {
      if (e instanceof ForbiddenException) {
        throw e;
      }

      throw new UnauthorizedException(this.INVALID_TOKEN_MESSAGE);
    }
  }
}
