import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { MoreThan, Repository } from 'typeorm';

import { ResetPasswordToken } from 'src/entities';
import { HashService } from 'src/modules/hash/hash.service';

@Injectable()
export class ResetPasswordTokenService {
  constructor(
    @InjectRepository(ResetPasswordToken)
    private readonly resetPasswordTokenRepository: Repository<ResetPasswordToken>,
    private readonly hashService: HashService,
  ) {}

  public generateResetPasswordToken() {
    return randomBytes(32).toString('hex');
  }

  async create(userId: string) {
    const token = this.generateResetPasswordToken();
    const tokenHash = await this.hashService.hash(token);
    await this.resetPasswordTokenRepository.save({
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
      userId,
    });

    return token;
  }

  async verifyAndDelete(userId: string, token: string) {
    const resetPasswordToken = await this.resetPasswordTokenRepository.findOne({
      where: { userId, expiresAt: MoreThan(new Date()) },
    });
    if (!resetPasswordToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const isTokenValid = await this.hashService.compare(
      token,
      resetPasswordToken.tokenHash,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.resetPasswordTokenRepository.delete(resetPasswordToken.id);
  }
}
