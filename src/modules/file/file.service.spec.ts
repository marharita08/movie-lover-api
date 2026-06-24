import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { File } from 'src/entities';
import { StorageService } from 'src/modules/storage/storage.service';
import { TranslationService } from 'src/modules/translation/translation.service';

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
  let fileRepository: jest.Mocked<ReturnType<typeof mockFileRepository>>;
  let storageService: jest.Mocked<ReturnType<typeof mockStorageService>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: getRepositoryToken(File), useFactory: mockFileRepository },
        { provide: StorageService, useFactory: mockStorageService },
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
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
        publicUrl: fileEntity.url,
        key: fileEntity.key,
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
    it('should return file if exists', async () => {
      const file = makeFile();
      fileRepository.findOne.mockResolvedValue(file);

      const result = await service.findOne('file-uuid');

      expect(fileRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'file-uuid' },
      });
      expect(result).toBe(file);
    });

    it('should throw NotFoundException if file not found', async () => {
      fileRepository.findOne.mockResolvedValue(null as any);

      await expect(service.findOne('file-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete file from storage and repo', async () => {
      const file = makeFile();
      fileRepository.findOne.mockResolvedValue(file);
      storageService.deleteFile.mockResolvedValue(undefined);
      fileRepository.remove.mockResolvedValue(file as any);

      await service.delete('file-uuid');

      expect(storageService.deleteFile).toHaveBeenCalledWith(file.key);
      expect(fileRepository.remove).toHaveBeenCalledWith(file);
    });

    it('should throw NotFoundException and skip storage/repo when file not found', async () => {
      fileRepository.findOne.mockResolvedValue(null as any);

      await expect(service.delete('file-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all files from storage and repo', async () => {
      const files = [
        makeFile({ id: '1', key: 'k1' }),
        makeFile({ id: '2', key: 'k2' }),
      ];
      fileRepository.find.mockResolvedValue(files);
      storageService.deleteFile.mockResolvedValue(undefined);
      fileRepository.remove.mockResolvedValue(files as any);

      await service.deleteByUserId('user-uuid');

      expect(fileRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
      });
      expect(storageService.deleteFile).toHaveBeenCalledTimes(2);
      expect(fileRepository.remove).toHaveBeenCalledWith(files);
    });

    it('should remove only successfully deleted files when some storage deletions fail', async () => {
      const files = [
        makeFile({ id: '1', key: 'k1' }),
        makeFile({ id: '2', key: 'k2' }),
      ];
      fileRepository.find.mockResolvedValue(files);
      storageService.deleteFile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('fail'));
      fileRepository.remove.mockResolvedValue([] as any);

      await service.deleteByUserId('user-uuid');

      expect(fileRepository.remove).toHaveBeenCalledWith([files[0]]);
    });

    it('should do nothing if no files exist', async () => {
      fileRepository.find.mockResolvedValue([]);

      await service.deleteByUserId('user-uuid');

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.remove).toHaveBeenCalledWith([]);
    });
  });

  describe('download', () => {
    it('should return download result for existing file', async () => {
      const file = makeFile();
      fileRepository.findOne.mockResolvedValue(file);
      storageService.downloadFile.mockResolvedValue(
        'https://cdn.example.com/signed',
      );

      const result = await service.download('file-uuid');

      expect(storageService.downloadFile).toHaveBeenCalledWith(file.key);
      expect(result).toBe('https://cdn.example.com/signed');
    });

    it('should throw NotFoundException and skip download when file not found', async () => {
      fileRepository.findOne.mockResolvedValue(null as any);

      await expect(service.download('file-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(storageService.downloadFile).not.toHaveBeenCalled();
    });
  });
});
