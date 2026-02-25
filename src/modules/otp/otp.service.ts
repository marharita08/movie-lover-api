import { BadRequestException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Otp, OtpPurpose } from 'src/entities';

const RESEND_COOLDOWN_MS = 60_000;

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
  ) {}

  generateCode(): number {
    return Math.floor(1000 + Math.random() * 9000);
  }

  async create(email: string, purpose: OtpPurpose): Promise<number> {
    const lastOtp = await this.otpRepository.findOne({
      where: { email, purpose },
    });

    if (lastOtp) {
      const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
      if (timeSinceLastOtp < RESEND_COOLDOWN_MS) {
        const timeUntilResend = RESEND_COOLDOWN_MS - timeSinceLastOtp;
        throw new BadRequestException(
          `Please wait ${Math.ceil(timeUntilResend / 1000)} seconds before resending OTP`,
        );
      }
      await this.otpRepository.remove(lastOtp);
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otp = this.otpRepository.create({ email, code, expiresAt, purpose });
    await this.otpRepository.save(otp);
    return code;
  }

  async verifyAndDelete(
    email: string,
    code: number,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otp = await this.otpRepository.findOne({
      where: { email, code, purpose },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    await this.otpRepository.remove(otp);
  }
}
