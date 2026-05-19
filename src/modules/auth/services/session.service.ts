import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { TranslationKeys } from 'src/const/translations/keys';
import { Session } from 'src/entities';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private userService: UserService,
    private i18n: I18nService,
  ) {}

  async getOrCreate(
    id: string,
    userId: string,
    refreshToken?: string,
  ): Promise<Session> {
    const sessionInDb = await this.sessionRepository.findOne({
      where: { id, userId },
    });

    if (sessionInDb) {
      return sessionInDb;
    }

    const session = this.sessionRepository.create({
      id,
      userId,
      refreshToken,
    });
    return this.sessionRepository.save(session);
  }

  async getById(id: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!session || !session.user) {
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_SESSION_NOT_FOUND),
      );
    }

    await this.userService.update(session.user.id, {
      lastActiveAt: new Date(),
    });

    return session;
  }

  async save(session: Session): Promise<void> {
    const sessionInDb = await this.sessionRepository.findOne({
      where: { id: session.id, userId: session.userId },
    });

    if (sessionInDb) {
      sessionInDb.refreshToken = session.refreshToken;
      await this.sessionRepository.save(sessionInDb);
      return;
    }

    const newSession = this.sessionRepository.create(session);
    await this.sessionRepository.save(newSession);
  }

  async deleteAllSessions(userId: string): Promise<void> {
    await this.sessionRepository.delete({ userId });
  }
}
