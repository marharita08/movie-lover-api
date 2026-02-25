import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Session, User } from 'src/entities';
import { UserService } from 'src/modules/user/user.service';

import { SessionService } from './session.service';

const mockSessionRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const mockUserService = () => ({
  update: jest.fn(),
});

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    email: 'test@example.com',
    ...overrides,
  }) as User;

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: 'session-uuid',
    userId: 'user-uuid',
    refreshToken: 'refresh-token',
    user: makeUser(),
    ...overrides,
  }) as Session;

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<Repository<Session>>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session),
          useFactory: mockSessionRepository,
        },
        { provide: UserService, useFactory: mockUserService },
      ],
    }).compile();

    service = module.get(SessionService);
    sessionRepository = module.get(getRepositoryToken(Session));
    userService = module.get(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreate', () => {
    it('should return existing session if found', async () => {
      const session = makeSession();
      const user = makeUser();
      sessionRepository.findOne.mockResolvedValue(session);

      const result = await service.getOrCreate(
        'session-uuid',
        user,
        'refresh-token',
      );

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'session-uuid', userId: user.id },
      });
      expect(sessionRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(session);
    });

    it('should create and save new session if not found', async () => {
      const user = makeUser();
      const newSession = makeSession();
      sessionRepository.findOne.mockResolvedValue(null as never);
      sessionRepository.create.mockReturnValue(newSession);
      sessionRepository.save.mockResolvedValue(newSession);

      const result = await service.getOrCreate(
        'session-uuid',
        user,
        'refresh-token',
      );

      expect(sessionRepository.create).toHaveBeenCalledWith({
        id: 'session-uuid',
        userId: user.id,
        refreshToken: 'refresh-token',
      });
      expect(sessionRepository.save).toHaveBeenCalledWith(newSession);
      expect(result).toBe(newSession);
    });

    it('should create session without refreshToken if not provided', async () => {
      const user = makeUser();
      const newSession = makeSession({ refreshToken: undefined });
      sessionRepository.findOne.mockResolvedValue(null as never);
      sessionRepository.create.mockReturnValue(newSession);
      sessionRepository.save.mockResolvedValue(newSession);

      await service.getOrCreate('session-uuid', user);

      expect(sessionRepository.create).toHaveBeenCalledWith({
        id: 'session-uuid',
        userId: user.id,
        refreshToken: undefined,
      });
    });
  });

  describe('getById', () => {
    it('should return session and update user lastActiveAt', async () => {
      const session = makeSession();
      sessionRepository.findOne.mockResolvedValue(session);
      userService.update.mockResolvedValue(session.user as never);

      const result = await service.getById('session-uuid');

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'session-uuid' },
        relations: ['user'],
      });
      expect(userService.update).toHaveBeenCalledWith(
        session?.user?.id,
        expect.objectContaining({ lastActiveAt: expect.any(Date) as Date }),
      );
      expect(result).toBe(session);
    });

    it('should throw NotFoundException if session is not found', async () => {
      sessionRepository.findOne.mockResolvedValue(null as never);

      await expect(service.getById('session-uuid')).rejects.toThrow(
        NotFoundException,
      );
      expect(userService.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if session has no user', async () => {
      const session = makeSession({ user: undefined });
      sessionRepository.findOne.mockResolvedValue(session);

      await expect(service.getById('session-uuid')).rejects.toThrow(
        NotFoundException,
      );
      expect(userService.update).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('should update refreshToken if session already exists', async () => {
      const existingSession = makeSession();
      const updatedSession = makeSession({ refreshToken: 'new-refresh-token' });
      sessionRepository.findOne.mockResolvedValue(existingSession);

      await service.save(updatedSession);

      expect(existingSession.refreshToken).toBe('new-refresh-token');
      expect(sessionRepository.save).toHaveBeenCalledWith(existingSession);
      expect(sessionRepository.create).not.toHaveBeenCalled();
    });

    it('should create and save new session if not found', async () => {
      const session = makeSession();
      sessionRepository.findOne.mockResolvedValue(null as never);
      sessionRepository.create.mockReturnValue(session);

      await service.save(session);

      expect(sessionRepository.create).toHaveBeenCalledWith(session);
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
    });
  });

  describe('deleteAllSessions', () => {
    it('should delete all sessions for given userId', async () => {
      sessionRepository.delete.mockResolvedValue({ affected: 3, raw: [] });

      await service.deleteAllSessions('user-uuid');

      expect(sessionRepository.delete).toHaveBeenCalledWith({
        userId: 'user-uuid',
      });
    });
  });
});
