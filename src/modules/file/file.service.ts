import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { File } from 'src/entities';
import { StorageService } from 'src/modules/storage/storage.service';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly storageService: StorageService,
  ) {}

  async upload(file: Express.Multer.File, userId: string): Promise<File> {
    const { publicUrl, key } = await this.storageService.uploadFile(file);

    const fileEntity = this.fileRepository.create({
      name: file.originalname,
      key,
      url: publicUrl,
      type: file.mimetype,
      size: file.size,
      userId,
    });

    return this.fileRepository.save(fileEntity);
  }

  async findOne(id: string): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async delete(fileId: string): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.storageService.deleteFile(file.key);
    await this.fileRepository.remove(file);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const files = await this.fileRepository.find({ where: { userId } });

    const results = await Promise.allSettled(
      files.map((file) => this.storageService.deleteFile(file.key)),
    );

    const filesToDelete = files.filter((_, index) => {
      const result = results[index];
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to delete file "${files[index].key}" from storage: ${result.reason}`,
        );
        return false;
      }
      return true;
    });

    await this.fileRepository.remove(filesToDelete);
  }

  async download(fileId: string): Promise<string> {
    const file = await this.findOne(fileId);
    return this.storageService.downloadFile(file.key);
  }
}
