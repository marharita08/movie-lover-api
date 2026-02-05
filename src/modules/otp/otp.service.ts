import { BadRequestException } from '@nestjs/common';
import { Otp } from 'src/entities/otp.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
  ) {}

  generateCode(): number {
    return Math.floor(1000 + Math.random() * 9000);
  }

  async create(email: string): Promise<number> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otp = this.otpRepository.create({ email, code, expiresAt });
    await this.otpRepository.save(otp);
    return code;
  }

  async verifyAndDelete(email: string, code: number): Promise<void> {
    const otp = await this.otpRepository.findOne({ where: { email, code } });
    if (!otp) {
      throw new BadRequestException('OTP is used or not exists');
    }
    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }
    await this.otpRepository.remove(otp);
  }
}
