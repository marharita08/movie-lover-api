import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@sendinblue/client';
import { I18nService } from 'nestjs-i18n';

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

const mockI18nService = {
  t: jest.fn((key: string) => key),
};

const createMockConfigService = (
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

const buildModule = (
  configOverrides: Record<string, string | undefined> = {},
) =>
  Test.createTestingModule({
    providers: [
      EmailService,
      { provide: I18nService, useValue: mockI18nService },
      {
        provide: ConfigService,
        useValue: createMockConfigService(configOverrides),
      },
    ],
  }).compile();

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await buildModule();
    service = module.get(EmailService);
  });

  describe('constructor', () => {
    it('should initialize client and set api key', () => {
      expect(MockTransactionalEmailsApi).toHaveBeenCalledTimes(1);

      expect(mockSetApiKey).toHaveBeenCalledWith(
        TransactionalEmailsApiApiKeys.apiKey,
        'test-api-key',
      );
    });

    it('should throw if BREVO_API_KEY is missing', async () => {
      await expect(buildModule({ BREVO_API_KEY: undefined })).rejects.toThrow();
    });

    it('should throw if sender config is missing', async () => {
      await expect(
        buildModule({ BREVO_FROM_EMAIL: undefined }),
      ).rejects.toThrow();

      await expect(
        buildModule({ BREVO_FROM_NAME: undefined }),
      ).rejects.toThrow();
    });
  });

  describe('sendEmail', () => {
    it('should send email with full payload', async () => {
      mockSendTransacEmail.mockResolvedValue({});

      await service.sendEmail(
        'user@example.com',
        'Welcome!',
        'Text content',
        '<b>HTML</b>',
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith({
        to: [{ email: 'user@example.com' }],
        sender: {
          email: 'no-reply@example.com',
          name: 'Test App',
        },
        subject: 'Welcome!',
        textContent: 'Text content',
        htmlContent: '<b>HTML</b>',
      });
    });

    it('should send email without html content', async () => {
      mockSendTransacEmail.mockResolvedValue({});

      await service.sendEmail('user@example.com', 'Hello', 'Text only');

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          textContent: 'Text only',
          htmlContent: undefined,
        }),
      );
    });

    it('should throw InternalServerErrorException when API fails', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Network error'));

      await expect(
        service.sendEmail('user@example.com', 'Subj', 'Text'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on API error response', async () => {
      mockSendTransacEmail.mockRejectedValue({
        response: { body: 'Bad credentials' },
      });

      await expect(
        service.sendEmail('user@example.com', 'Subj', 'Text'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
