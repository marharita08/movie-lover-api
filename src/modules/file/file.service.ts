import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TranslationKeys } from 'src/const/translations/keys';
import { File } from 'src/entities';
import { StorageService } from 'src/modules/storage/storage.service';
import { TranslationService } from 'src/modules/translation/translation.service';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly storageService: StorageService,
    private readonly i18n: TranslationService,
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
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_FILE_NOT_FOUND),
      );
    }

    return file;
  }

  async delete(fileId: string): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_FILE_NOT_FOUND),
      );
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

  @Cron('0 3 27 * *')
  async handleOrphanCleanup(): Promise<void> {
    this.logger.log('Starting orphan files cleanup in GCS...');

    const dbKeys = new Set(
      (await this.fileRepository.find({ select: ['key'] })).map((f) => f.key),
    );

    const { deleted, failed, skipped } =
      await this.storageService.cleanupOrphanFiles(dbKeys);

    this.logger.log(
      `Orphan cleanup finished. Deleted: ${deleted}, Failed: ${failed}, Skipped (missing timeCreated): ${skipped}.`,
    );
  }
}
