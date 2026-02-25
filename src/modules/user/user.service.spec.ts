import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from 'src/entities';
import { FileService } from 'src/modules/file/file.service';

import { UserService } from './user.service';

const mockUserRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
});

const mockFileService = () => ({
  deleteByUserId: jest.fn(),
});

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed',
    name: 'Test User',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as User;

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let fileService: jest.Mocked<FileService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        { provide: FileService, useFactory: mockFileService },
      ],
    }).compile();

    service = module.get(UserService);
    userRepository = module.get(getRepositoryToken(User));
    fileService = module.get(FileService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getById', () => {
    it('should return UserDto without passwordHash', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getById('uuid-1');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw NotFoundException if user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getById('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getByEmail', () => {
    it('should return user if found', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getByEmail('test@example.com');
      expect(result).toBe(user);
    });

    it('should return null if user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.getByEmail('missing@example.com');
      expect(result).toBeNull();
    });
  });

  describe('getByEmailOrThrow', () => {
    it('should return user if found', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getByEmailOrThrow('test@example.com');
      expect(result).toBe(user);
    });

    it('should throw NotFoundException if user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getByEmailOrThrow('missing@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return user without passwordHash', async () => {
      const user = makeUser();
      userRepository.create.mockReturnValue(user);

      const result = await service.create({
        email: 'test@example.com',
        passwordHash: 'hashed',
        name: 'Test User',
        lastActiveAt: new Date(),
        lastLoginAt: new Date(),
      });

      expect(userRepository.create).toHaveBeenCalled();
      expect(user.save).toHaveBeenCalled();
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('update', () => {
    it('should update and return user without passwordHash', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.update('uuid-1', { name: 'New Name' });

      expect(user.save).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException if user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.update('not-exist', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete user files and user itself', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);
      fileService.deleteByUserId.mockResolvedValue(undefined);
      userRepository.remove.mockResolvedValue(user);

      await service.delete('uuid-1');

      expect(fileService.deleteByUserId).toHaveBeenCalledWith('uuid-1');
      expect(userRepository.remove).toHaveBeenCalledWith(user);
    });

    it('should throw NotFoundException if user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('not-exist')).rejects.toThrow(
        NotFoundException,
      );
      expect(fileService.deleteByUserId).not.toHaveBeenCalled();
    });
  });
});
