import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Otp, OtpPurpose } from 'src/entities';

import { OtpService } from './otp.service';

const mockOtpRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const makeOtp = (overrides: Partial<Otp> = {}): Otp =>
  ({
    id: 'otp-uuid-1',
    email: 'test@example.com',
    code: 1234,
    purpose: OtpPurpose.EMAIL_VERIFICATION,
    createdAt: new Date(Date.now() - 120_000), // 2 minutes ago — outside cooldown
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    ...overrides,
  }) as unknown as Otp;

describe('OtpService', () => {
  let service: OtpService;
  let otpRepository: jest.Mocked<Repository<Otp>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getRepositoryToken(Otp), useFactory: mockOtpRepository },
      ],
    }).compile();

    service = module.get(OtpService);
    otpRepository = module.get(getRepositoryToken(Otp));
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateCode', () => {
    it('should return a 4-digit number between 1000 and 9999', () => {
      for (let i = 0; i < 20; i++) {
        const code = service.generateCode();
        expect(code).toBeGreaterThanOrEqual(1000);
        expect(code).toBeLessThanOrEqual(9999);
      }
    });
  });

  describe('create', () => {
    it('should create and save a new OTP when no previous OTP exists', async () => {
      otpRepository.findOne.mockResolvedValue(null);
      const newOtp = makeOtp();
      otpRepository.create.mockReturnValue(newOtp);
      otpRepository.save.mockResolvedValue(newOtp);
      jest.spyOn(service, 'generateCode').mockReturnValue(1234);

      const code = await service.create(
        'test@example.com',
        OtpPurpose.EMAIL_VERIFICATION,
      );

      expect(otpRepository.findOne).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          purpose: OtpPurpose.EMAIL_VERIFICATION,
        },
      });
      expect(otpRepository.remove).not.toHaveBeenCalled();
      expect(otpRepository.create).toHaveBeenCalled();
      expect(otpRepository.save).toHaveBeenCalledWith(newOtp);
      expect(code).toBe(1234);
    });

    it('should remove the old OTP and create a new one when cooldown has passed', async () => {
      const oldOtp = makeOtp({ createdAt: new Date(Date.now() - 120_000) });
      otpRepository.findOne.mockResolvedValue(oldOtp);
      const newOtp = makeOtp({ code: 5678 });
      otpRepository.create.mockReturnValue(newOtp);
      otpRepository.save.mockResolvedValue(newOtp);
      jest.spyOn(service, 'generateCode').mockReturnValue(5678);

      const code = await service.create(
        'test@example.com',
        OtpPurpose.EMAIL_VERIFICATION,
      );

      expect(otpRepository.remove).toHaveBeenCalledWith(oldOtp);
      expect(otpRepository.save).toHaveBeenCalled();
      expect(code).toBe(5678);
    });

    it('should throw BadRequestException if resend cooldown has not passed', async () => {
      const recentOtp = makeOtp({ createdAt: new Date(Date.now() - 20_000) }); // 20s ago
      otpRepository.findOne.mockResolvedValue(recentOtp);

      await expect(
        service.create('test@example.com', OtpPurpose.EMAIL_VERIFICATION),
      ).rejects.toThrow(BadRequestException);

      expect(otpRepository.remove).not.toHaveBeenCalled();
      expect(otpRepository.save).not.toHaveBeenCalled();
    });

    it('should include remaining seconds in the cooldown error message', async () => {
      const recentOtp = makeOtp({ createdAt: new Date(Date.now() - 20_000) }); // 20s ago
      otpRepository.findOne.mockResolvedValue(recentOtp);

      await expect(
        service.create('test@example.com', OtpPurpose.EMAIL_VERIFICATION),
      ).rejects.toThrow(/Please wait \d+ seconds before resending OTP/);
    });
  });

  describe('verifyAndDelete', () => {
    it('should remove the OTP when it is valid and not expired', async () => {
      const otp = makeOtp();
      otpRepository.findOne.mockResolvedValue(otp);

      await service.verifyAndDelete(
        'test@example.com',
        1234,
        OtpPurpose.EMAIL_VERIFICATION,
      );

      expect(otpRepository.findOne).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          code: 1234,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
        },
      });
      expect(otpRepository.remove).toHaveBeenCalledWith(otp);
    });

    it('should throw BadRequestException when OTP is not found', async () => {
      otpRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyAndDelete(
          'test@example.com',
          9999,
          OtpPurpose.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(new BadRequestException('Invalid or expired OTP'));

      expect(otpRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when OTP is expired', async () => {
      const expiredOtp = makeOtp({ expiresAt: new Date(Date.now() - 1000) }); // expired 1s ago
      otpRepository.findOne.mockResolvedValue(expiredOtp);

      await expect(
        service.verifyAndDelete(
          'test@example.com',
          1234,
          OtpPurpose.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(new BadRequestException('Invalid or expired OTP'));

      expect(otpRepository.remove).not.toHaveBeenCalled();
    });
  });
});
