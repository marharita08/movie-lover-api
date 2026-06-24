import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  SendSmtpEmail,
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@sendinblue/client';

import { brevoConfig } from 'src/config';
import { TranslationKeys } from 'src/const/translations/keys';
import { TranslationService } from 'src/modules/translation/translation.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: TransactionalEmailsApi;

  constructor(
    @Inject(brevoConfig.KEY)
    private readonly config: ConfigType<typeof brevoConfig>,
    private readonly i18n: TranslationService,
  ) {
    this.client = new TransactionalEmailsApi();
    this.client.setApiKey(TransactionalEmailsApiApiKeys.apiKey, config.apiKey);
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const sendSmtpEmail: SendSmtpEmail = {
      to: [{ email: to }],
      sender: { email: this.config.fromEmail, name: this.config.fromName },
      subject,
      htmlContent: html,
      textContent: text,
    };

    try {
      await this.client.sendTransacEmail(sendSmtpEmail);
    } catch (error) {
      this.logger.error('Error sending email:', error);
      throw new InternalServerErrorException(
        this.i18n.t(TranslationKeys.ERROR_EMAIL_SEND_FAILED),
      );
    }
  }
}
