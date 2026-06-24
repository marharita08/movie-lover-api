import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { googleOAuthConfig } from 'src/config/google-oauth.config';
import { TranslationKeys } from 'src/const/translations/keys';
import { TranslationService } from 'src/modules/translation/translation.service';

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;
  private clientId?: string;
  private logger = new Logger(GoogleAuthService.name);

  constructor(
    @Inject(googleOAuthConfig.KEY)
    private readonly config: ConfigType<typeof googleOAuthConfig>,
    private i18n: TranslationService,
  ) {
    this.clientId = this.config.clientId;
    this.client = new OAuth2Client(this.clientId, this.config.clientSecret);
  }

  async verifyGoogleToken(code: string) {
    try {
      const { tokens } = await this.client.getToken({
        code,
        redirect_uri: 'postmessage',
      });

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload?.email) {
        throw new UnauthorizedException(
          this.i18n.t(TranslationKeys.ERROR_AUTHORIZATION_FAILED),
        );
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch (error) {
      this.logger.error('Authorization failed', error);
      throw new UnauthorizedException(
        this.i18n.t(TranslationKeys.ERROR_AUTHORIZATION_FAILED),
      );
    }
  }
}
