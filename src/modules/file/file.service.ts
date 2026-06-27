import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CLEANUP_FILES_SAFETY_BUFFER_MS } from 'src/const/cleanup-files-safety-buffer';
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
    const filesToDelete = await this.deleteFromStorage(files);
    await this.fileRepository.remove(filesToDelete);
  }

  async download(fileId: string): Promise<string> {
    const file = await this.findOne(fileId);
    return this.storageService.downloadFile(file.key);
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
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

  @Cron(CronExpression.EVERY_DAY_AT_3PM)
  async handleFilesWithoutListCleanup(): Promise<void> {
    this.logger.log('Starting cleanup of files not linked to any list...');

    const cutoffDate = new Date(Date.now() - CLEANUP_FILES_SAFETY_BUFFER_MS);

    const filesWithoutList = await this.fileRepository
      .createQueryBuilder('file')
      .leftJoin('file.list', 'list')
      .where('list.id IS NULL')
      .andWhere('file.createdAt < :cutoffDate', { cutoffDate })
      .getMany();

    if (filesWithoutList.length === 0) {
      this.logger.log('No files without a list found.');
      return;
    }

    const filesToRemove = await this.deleteFromStorage(filesWithoutList);
    await this.fileRepository.remove(filesToRemove);

    this.logger.log(
      `Files-without-list cleanup finished. Deleted: ${filesToRemove.length}, Failed: ${filesWithoutList.length - filesToRemove.length}.`,
    );
  }

  private async deleteFromStorage(files: File[]): Promise<File[]> {
    const results = await Promise.allSettled(
      files.map((file) => this.storageService.deleteFile(file.key)),
    );

    return files.filter((file, index) => {
      const result = results[index];
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to delete file "${file.key}" from storage: ${result.reason}`,
        );
        return false;
      }
      return true;
    });
  }
}
