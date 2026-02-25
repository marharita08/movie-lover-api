import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { File } from 'src/entities';
import { StorageService } from 'src/modules/storage/storage.service';

import { FileService } from './file.service';

const mockFileRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

const mockStorageService = () => ({
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  downloadFile: jest.fn(),
});

const makeFile = (overrides: Partial<File> = {}): File =>
  ({
    id: 'file-uuid',
    name: 'test.png',
    key: 'uploads/test.png',
    url: 'https://cdn.example.com/test.png',
    type: 'image/png',
    size: 1024,
    userId: 'user-uuid',
    ...overrides,
  }) as File;

const makeMulterFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'test.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from(''),
    ...overrides,
  }) as Express.Multer.File;

describe('FileService', () => {
  let service: FileService;
  let fileRepository: jest.Mocked<Repository<File>>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: getRepositoryToken(File),
          useFactory: mockFileRepository,
        },
        { provide: StorageService, useFactory: mockStorageService },
      ],
    }).compile();

    service = module.get(FileService);
    fileRepository = module.get(getRepositoryToken(File));
    storageService = module.get(StorageService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('upload', () => {
    it('should upload file to storage and save entity', async () => {
      const multerFile = makeMulterFile();
      const fileEntity = makeFile();
      storageService.uploadFile.mockResolvedValue({
        publicUrl: 'https://cdn.example.com/test.png',
        key: 'uploads/test.png',
      });
      fileRepository.create.mockReturnValue(fileEntity);
      fileRepository.save.mockResolvedValue(fileEntity);

      const result = await service.upload(multerFile, 'user-uuid');

      expect(storageService.uploadFile).toHaveBeenCalledWith(multerFile);
      expect(fileRepository.create).toHaveBeenCalledWith({
        name: 'test.png',
        key: 'uploads/test.png',
        url: 'https://cdn.example.com/test.png',
        type: 'image/png',
        size: 1024,
        userId: 'user-uuid',
      });
      expect(fileRepository.save).toHaveBeenCalledWith(fileEntity);
      expect(result).toBe(fileEntity);
    });
  });

  describe('findOne', () => {
    it('should return file if found', async () => {
      const file = makeFile();
      fileRepository.findOne.mockResolvedValue(file);

      const result = await service.findOne('file-uuid');

      expect(fileRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'file-uuid' },
      });
      expect(result).toBe(file);
    });

    it('should throw NotFoundException if file is not found', async () => {
      fileRepository.findOne.mockResolvedValue(null as never);

      await expect(service.findOne('file-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete file from storage and repository', async () => {
      const file = makeFile();
      fileRepository.findOne.mockResolvedValue(file);
      storageService.deleteFile.mockResolvedValue(undefined);
      fileRepository.remove.mockResolvedValue(file);

      await service.delete('file-uuid');

      expect(storageService.deleteFile).toHaveBeenCalledWith(file.key);
      expect(fileRepository.remove).toHaveBeenCalledWith(file);
    });

    it('should throw NotFoundException if file is not found', async () => {
      fileRepository.findOne.mockResolvedValue(null as never);

      await expect(service.delete('file-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all files for given userId from storage and repository', async () => {
      const files = [
        makeFile({ id: 'file-uuid-1', key: 'uploads/file1.png' }),
        makeFile({ id: 'file-uuid-2', key: 'uploads/file2.png' }),
      ];
      fileRepository.find.mockResolvedValue(files);
      storageService.deleteFile.mockResolvedValue(undefined);
      fileRepository.remove.mockResolvedValue(files as never);

      await service.deleteByUserId('user-uuid');

      expect(fileRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
      });
      expect(storageService.deleteFile).toHaveBeenCalledTimes(2);
      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'uploads/file1.png',
      );
      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'uploads/file2.png',
      );
      expect(fileRepository.remove).toHaveBeenCalledWith(files);
    });

    it('should skip files that failed to delete from storage', async () => {
      const files = [
        makeFile({ id: 'file-uuid-1', key: 'uploads/file1.png' }),
        makeFile({ id: 'file-uuid-2', key: 'uploads/file2.png' }),
      ];
      fileRepository.find.mockResolvedValue(files);
      storageService.deleteFile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Storage error'));
      fileRepository.remove.mockResolvedValue([files[0]] as never);

      await service.deleteByUserId('user-uuid');

      expect(fileRepository.remove).toHaveBeenCalledWith([files[0]]);
    });

    it('should not call repository.remove if all files failed to delete from storage', async () => {
      const files = [makeFile({ id: 'file-uuid-1', key: 'uploads/file1.png' })];
      fileRepository.find.mockResolvedValue(files);
      storageService.deleteFile.mockRejectedValue(new Error('Storage error'));
      fileRepository.remove.mockResolvedValue([] as never);

      await service.deleteByUserId('user-uuid');

      expect(fileRepository.remove).toHaveBeenCalledWith([]);
    });

    it('should do nothing if user has no files', async () => {
      fileRepository.find.mockResolvedValue([]);

      await service.deleteByUserId('user-uuid');

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.remove).toHaveBeenCalledWith([]);
    });
  });

  describe('download', () => {
    it('should return download url for file', async () => {
      const file = makeFile();
      fileRepository.findOne.mockResolvedValue(file);
      storageService.downloadFile.mockResolvedValue(
        'https://cdn.example.com/signed-url',
      );

      const result = await service.download('file-uuid');

      expect(storageService.downloadFile).toHaveBeenCalledWith(file.key);
      expect(result).toBe('https://cdn.example.com/signed-url');
    });

    it('should throw NotFoundException if file is not found', async () => {
      fileRepository.findOne.mockResolvedValue(null as never);

      await expect(service.download('file-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(storageService.downloadFile).not.toHaveBeenCalled();
    });
  });
});
