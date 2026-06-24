import { Storage } from '@google-cloud/storage';
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { gcpConfig } from 'src/config';

import { StorageService } from './storage.service';

jest.mock('@google-cloud/storage');

const mockSave = jest.fn();
const mockDelete = jest.fn();
const mockDownload = jest.fn();

const mockFile = jest.fn(() => ({
  save: mockSave,
  delete: mockDelete,
  download: mockDownload,
}));

const mockBucket = jest.fn(() => ({ file: mockFile }));

(Storage as jest.MockedClass<typeof Storage>).mockImplementation(
  () => ({ bucket: mockBucket }) as unknown as Storage,
);

const makeMulterFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'test-file.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from('col1,col2\nval1,val2'),
    ...overrides,
  }) as Express.Multer.File;

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: gcpConfig.KEY,
          useValue: {
            projectId: 'test-project',
            clientEmail: 'test@test.iam.gserviceaccount.com',
            privateKey: 'test-private-key',
            bucketName: 'test-bucket',
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  describe('uploadFile', () => {
    it('should save the file and return publicUrl and key', async () => {
      mockSave.mockResolvedValue(undefined);
      jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

      const result = await service.uploadFile(makeMulterFile());

      expect(mockBucket).toHaveBeenCalledWith('test-bucket');
      expect(mockFile).toHaveBeenCalledWith('1700000000000-test-file.csv');
      expect(mockSave).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          metadata: { contentType: 'text/csv' },
          resumable: false,
        }),
      );
      expect(result).toEqual({
        publicUrl:
          'https://storage.googleapis.com/test-bucket/1700000000000-test-file.csv',
        key: '1700000000000-test-file.csv',
      });
    });

    it('should throw InternalServerErrorException when save fails', async () => {
      mockSave.mockRejectedValue(new Error('GCS error'));

      await expect(service.uploadFile(makeMulterFile())).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteFile', () => {
    it('should call delete on the correct file', async () => {
      mockDelete.mockResolvedValue(undefined);

      await service.deleteFile('some-file.csv');

      expect(mockBucket).toHaveBeenCalledWith('test-bucket');
      expect(mockFile).toHaveBeenCalledWith('some-file.csv');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when delete fails', async () => {
      mockDelete.mockRejectedValue(new Error('GCS error'));

      await expect(service.deleteFile('some-file.csv')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('downloadFile', () => {
    it('should return the file content as a utf-8 string', async () => {
      mockDownload.mockResolvedValue([Buffer.from('col1,col2\nval1,val2')]);

      const result = await service.downloadFile('some-file.csv');

      expect(mockBucket).toHaveBeenCalledWith('test-bucket');
      expect(mockFile).toHaveBeenCalledWith('some-file.csv');
      expect(result).toBe('col1,col2\nval1,val2');
    });

    it('should throw InternalServerErrorException when download fails', async () => {
      mockDownload.mockRejectedValue(new Error('GCS error'));

      await expect(service.downloadFile('some-file.csv')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
