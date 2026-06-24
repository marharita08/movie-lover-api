import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@sendinblue/client';

import { brevoConfig } from 'src/config';
import { TranslationService } from 'src/modules/translation/translation.service';

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

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: brevoConfig.KEY,
          useValue: {
            apiKey: 'test-api-key',
            fromEmail: 'no-reply@example.com',
            fromName: 'Test App',
          },
        },
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
      ],
    }).compile();

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
  });

  describe('sendEmail', () => {
    it('should send email with correct payload', async () => {
      mockSendTransacEmail.mockResolvedValue({});

      await service.sendEmail(
        'user@example.com',
        'Welcome!',
        'Text content',
        '<b>HTML</b>',
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith({
        to: [{ email: 'user@example.com' }],
        sender: { email: 'no-reply@example.com', name: 'Test App' },
        subject: 'Welcome!',
        textContent: 'Text content',
        htmlContent: '<b>HTML</b>',
      });
    });

    it('should throw InternalServerErrorException when API fails', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Network error'));

      await expect(
        service.sendEmail('user@example.com', 'Subj', 'Text'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
