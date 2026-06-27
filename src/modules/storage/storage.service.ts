import { Storage } from '@google-cloud/storage';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { gcpConfig } from 'src/config';
import { CLEANUP_FILES_SAFETY_BUFFER_MS } from 'src/const/cleanup-files-safety-buffer';

interface CleanupOrphanFilesResult {
  deleted: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class StorageService {
  private readonly storage: Storage;
  private readonly logger = new Logger(StorageService.name);
  private readonly baseUrl = 'https://storage.googleapis.com';

  constructor(
    @Inject(gcpConfig.KEY)
    private readonly config: ConfigType<typeof gcpConfig>,
  ) {
    this.storage = new Storage({
      projectId: config.projectId,
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ publicUrl: string; key: string }> {
    try {
      const bucket = this.storage.bucket(this.config.bucketName);
      const fileName = `${Date.now()}-${file.originalname}`;
      const fileUpload = bucket.file(fileName);

      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
        resumable: false,
      });

      const publicUrl = `${this.baseUrl}/${this.config.bucketName}/${fileName}`;
      return { publicUrl, key: fileName };
    } catch (err) {
      this.logger.error(`Failed to upload file ${file.originalname}:`, err);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.storage.bucket(this.config.bucketName).file(fileName).delete();
    } catch (err) {
      this.logger.error(`Failed to delete file ${fileName}:`, err);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  async downloadFile(fileName: string): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.config.bucketName);
      const file = bucket.file(fileName);

      const [content] = await file.download();
      return content.toString('utf-8');
    } catch (err) {
      this.logger.error(`Failed to download file ${fileName}:`, err);
      throw new InternalServerErrorException('Failed to download file');
    }
  }

  async cleanupOrphanFiles(
    dbKeys: Set<string>,
    safetyBufferMs = CLEANUP_FILES_SAFETY_BUFFER_MS,
  ): Promise<CleanupOrphanFilesResult> {
    const bucket = this.storage.bucket(this.config.bucketName);

    let pageToken: string | undefined;
    let deleted = 0;
    let failed = 0;
    let skipped = 0;

    do {
      const [files, , response] = await bucket.getFiles({
        maxResults: 1000,
        pageToken,
      });

      const orphansOnPage = files.filter((file) => {
        if (!file.metadata.timeCreated) {
          this.logger.warn(
            `File "${file.name}" is missing timeCreated metadata, skipping.`,
          );
          skipped++;
          return false;
        }

        const isOldEnough =
          Date.now() - new Date(file.metadata.timeCreated).getTime() >
          safetyBufferMs;

        return !dbKeys.has(file.name) && isOldEnough;
      });

      const results = await Promise.allSettled(
        orphansOnPage.map((file) => file.delete()),
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          deleted++;
        } else {
          failed++;
          this.logger.error(
            `Failed to delete orphan file "${orphansOnPage[index].name}": ${result.reason}`,
          );
        }
      });

      pageToken = (response as { pageToken?: string })?.pageToken;
    } while (pageToken);

    return { deleted, failed, skipped };
  }
}
