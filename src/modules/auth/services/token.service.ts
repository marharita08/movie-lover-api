import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';

import { TranslationKeys } from 'src/const/translations/keys';
import { Session } from 'src/entities';
import { TranslationService } from 'src/modules/translation/translation.service';

import { JwtPayloadDto } from '../dto/jwt-payload.dto';

import { SessionService } from './session.service';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
    private configService: ConfigService,
    private i18n: TranslationService,
  ) {}

  private get invalidTokenMessage(): string {
    return this.i18n.t(TranslationKeys.ERROR_INVALID_TOKEN);
  }

  public async generateTokensPair(session: Session) {
    const payload: JwtPayloadDto = { sessionId: session.id };

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
      });

      if (!payload.sessionId) {
        throw new UnauthorizedException(this.invalidTokenMessage);
      }

      const session = await this.sessionService.getById(
        payload.sessionId as string,
      );
      if (!session) {
        throw new UnauthorizedException(this.invalidTokenMessage);
      }

      return session;
    } catch (error) {
      this.logger.error('Error verifying access token', error);
      throw new UnauthorizedException(this.invalidTokenMessage);
    }
  }

  public async verifyRefreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (!payload.sessionId) {
        throw new UnauthorizedException(this.invalidTokenMessage);
      }

      const session = await this.sessionService.getById(
        payload.sessionId as string,
      );

      if (!session || token !== session.refreshToken) {
        throw new UnauthorizedException(this.invalidTokenMessage);
      }

      return session;
    } catch (error) {
      this.logger.error('Error verifying refresh token', error);
      throw new UnauthorizedException(this.invalidTokenMessage);
    }
  }
}
