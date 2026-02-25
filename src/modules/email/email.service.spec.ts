import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@sendinblue/client';

import { EmailService } from './email.service';

jest.mock('@sendinblue/client');

const MockTransactionalEmailsApi = TransactionalEmailsApi as jest.MockedClass<
  typeof TransactionalEmailsApi
>;

const mockSendTransacEmail = jest.fn();
const mockSetApiKey = jest.fn();

MockTransactionalEmailsApi.mockImplementation(
  () =>
    ({
      setApiKey: mockSetApiKey,
      sendTransacEmail: mockSendTransacEmail,
    }) as unknown as TransactionalEmailsApi,
);

const mockConfigService = (
  overrides: Record<string, string | undefined> = {},
) => ({
  get: jest.fn((key: string) => {
    const cfg: Record<string, string> = {
      BREVO_API_KEY: 'test-api-key',
      BREVO_FROM_EMAIL: 'no-reply@example.com',
      BREVO_FROM_NAME: 'Test App',
      ...overrides,
    };
    return cfg[key];
  }),
});

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  describe('constructor', () => {
    it('should initialize the Brevo client and set the API key', () => {
      expect(MockTransactionalEmailsApi).toHaveBeenCalledTimes(1);
      expect(mockSetApiKey).toHaveBeenCalledWith(
        TransactionalEmailsApiApiKeys.apiKey,
        'test-api-key',
      );
    });

    it('should throw when BREVO_API_KEY is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EmailService,
            {
              provide: ConfigService,
              useFactory: () => mockConfigService({ BREVO_API_KEY: undefined }),
            },
          ],
        }).compile(),
      ).rejects.toThrow('BREVO_API_KEY is not set');
    });

    it('should throw when BREVO_FROM_EMAIL is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EmailService,
            {
              provide: ConfigService,
              useFactory: () =>
                mockConfigService({ BREVO_FROM_EMAIL: undefined }),
            },
          ],
        }).compile(),
      ).rejects.toThrow('BREVO_FROM_EMAIL or BREVO_FROM_NAME is not set');
    });

    it('should throw when BREVO_FROM_NAME is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EmailService,
            {
              provide: ConfigService,
              useFactory: () =>
                mockConfigService({ BREVO_FROM_NAME: undefined }),
            },
          ],
        }).compile(),
      ).rejects.toThrow('BREVO_FROM_EMAIL or BREVO_FROM_NAME is not set');
    });
  });

  describe('sendEmail', () => {
    it('should call sendTransacEmail with correct payload', async () => {
      mockSendTransacEmail.mockResolvedValue({});

      await service.sendEmail(
        'user@example.com',
        'Welcome!',
        'Plain text',
        '<b>HTML</b>',
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith({
        to: [{ email: 'user@example.com' }],
        sender: { email: 'no-reply@example.com', name: 'Test App' },
        subject: 'Welcome!',
        textContent: 'Plain text',
        htmlContent: '<b>HTML</b>',
      });
    });

    it('should send email without html when html is not provided', async () => {
      mockSendTransacEmail.mockResolvedValue({});

      await service.sendEmail('user@example.com', 'Hello', 'Text only');

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          textContent: 'Text only',
          htmlContent: undefined,
        }),
      );
    });

    it('should throw InternalServerErrorException when sendTransacEmail fails', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Network error'));

      await expect(
        service.sendEmail('user@example.com', 'Subj', 'Text'),
      ).rejects.toThrow(
        new InternalServerErrorException('Unable to send email'),
      );
    });

    it('should throw InternalServerErrorException and extract error details from response body', async () => {
      mockSendTransacEmail.mockRejectedValue({
        response: { body: 'Bad credentials' },
      });

      await expect(
        service.sendEmail('user@example.com', 'Subj', 'Text'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
