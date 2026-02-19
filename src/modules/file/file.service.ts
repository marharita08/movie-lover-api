import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { File } from 'src/entities/file.entity';
import { Repository } from 'typeorm';

import { StorageService } from '../storage/storage.service';

@Injectable()
export class FileService {
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

    await Promise.allSettled(
      files.map((file) => this.storageService.deleteFile(file.key)),
    );

    await this.fileRepository.remove(files);
  }

  async download(fileId: string): Promise<string> {
    const file = await this.findOne(fileId);
    return this.storageService.downloadFile(file.key);
  }
}
