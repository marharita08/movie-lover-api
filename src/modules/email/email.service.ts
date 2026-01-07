import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SendGrid from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly from: string;
  private readonly logger: Logger;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY is not set');
    }
    SendGrid.setApiKey(apiKey);
    const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!fromEmail) {
      throw new Error('SENDGRID_FROM_EMAIL is not set');
    }
    this.from = fromEmail;
    this.logger = new Logger('EmailService');
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const message: SendGrid.MailDataRequired = {
      to,
      from: this.from,
      subject,
      text,
      html: html || text,
    };
    try {
      await SendGrid.send(message);
    } catch (error) {
      const errorDetails = error?.response?.body ?? error?.message ?? error;
      this.logger.error('Error sending email:', errorDetails);
      throw new InternalServerErrorException('Unable to send email');
    }
  }
}
