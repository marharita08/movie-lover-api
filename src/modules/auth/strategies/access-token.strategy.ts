import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserService } from 'src/modules/user/user.service';

import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { SessionService } from '../services';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private sessionService: SessionService,
    private userService: UserService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new InternalServerErrorException(
        'JWT secret is missing in environment',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
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

    const { user, ...rest } = session;

    return {
      session: rest,
      ...this.userService.excludePrivateFields(user),
    };
  }
}
