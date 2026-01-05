import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Session, User } from 'src/entities';
import { UserService } from 'src/modules/user';
import { Repository } from 'typeorm';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private userService: UserService,
  ) {}

  async getOrCreate(
    id: string,
    user: User,
    refreshToken?: string,
  ): Promise<Session> {
    const sessionInDb = await this.sessionRepository.findOne({
      where: { id, userId: user.id },
    });

    if (sessionInDb) {
      return sessionInDb;
    }

    const session = this.sessionRepository.create({
      id,
      userId: user.id,
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
      throw new NotFoundException('Session not found');
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
}
