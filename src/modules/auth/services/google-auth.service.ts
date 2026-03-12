import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;
  private clientId?: string;
  private logger = new Logger(GoogleAuthService.name);

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client(
      this.clientId,
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    );
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
        throw new UnauthorizedException('Authorization failed');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch (error) {
      this.logger.error('Authorization failed', error);
      throw new UnauthorizedException('Authorization failed');
    }
  }
}
