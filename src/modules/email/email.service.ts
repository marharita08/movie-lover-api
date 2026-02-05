import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from '@sendinblue/client';

@Injectable()
export class EmailService {
  private readonly from: string;
  private readonly fromName: string;
  private readonly logger: Logger;
  private client: TransactionalEmailsApi;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY is not set');
    }
    this.client = new TransactionalEmailsApi();
    this.client.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

    const fromEmail = this.configService.get<string>('BREVO_FROM_EMAIL');
    const fromName = this.configService.get<string>('BREVO_FROM_NAME');
    if (!fromEmail || !fromName) {
      throw new Error('BREVO_FROM_EMAIL or BREVO_FROM_NAME is not set');
    }
    this.from = fromEmail;
    this.fromName = fromName;
    this.logger = new Logger('EmailService');
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const sendSmtpEmail: SendSmtpEmail = {
      to: [{ email: to }],
      sender: { email: this.from, name: this.fromName },
      subject,
      htmlContent: html,
      textContent: text,
    };

    try {
      await this.client.sendTransacEmail(sendSmtpEmail);
    } catch (error) {
      const errorDetails = error?.response?.body ?? error?.message ?? error;
      this.logger.error('Error sending email:', errorDetails);
      throw new InternalServerErrorException('Unable to send email');
    }
  }
}
