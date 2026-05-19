import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { MoreThan, Repository } from 'typeorm';

import { TranslationKeys } from 'src/const/translations/keys';
import { ResetPasswordToken } from 'src/entities';
import { HashService } from 'src/modules/hash/hash.service';
import { generateResetPasswordToken } from 'src/utils';

@Injectable()
export class ResetPasswordTokenService {
  constructor(
    @InjectRepository(ResetPasswordToken)
    private readonly resetPasswordTokenRepository: Repository<ResetPasswordToken>,
    private readonly hashService: HashService,
    private readonly i18n: I18nService,
  ) {}

  async create(userId: string) {
    const token = generateResetPasswordToken();
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
      throw new UnauthorizedException(
        this.i18n.t(TranslationKeys.ERROR_TOKEN_INVALID_OR_EXPIRED),
      );
    }

    const isTokenValid = await this.hashService.compare(
      token,
      resetPasswordToken.tokenHash,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException(
        this.i18n.t(TranslationKeys.ERROR_TOKEN_INVALID_OR_EXPIRED),
      );
    }

    await this.resetPasswordTokenRepository.delete(resetPasswordToken.id);
  }
}
