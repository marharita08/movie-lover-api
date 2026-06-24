import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { jwtConfig } from 'src/config';
import { UserService } from 'src/modules/user/user.service';

import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { SessionService } from '../services';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(jwtConfig.KEY)
    config: ConfigType<typeof jwtConfig>,
    private sessionService: SessionService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.secret,
    });
  }

  async validate(payload: JwtPayloadDto) {
    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const session = await this.sessionService.getById(payload.sessionId);

    if (!session?.user) {
      throw new UnauthorizedException('Session expired or not found');
    }

    return this.userService.excludePrivateFields(session.user);
  }
}
