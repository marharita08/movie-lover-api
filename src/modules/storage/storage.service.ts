import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('GCP_PROJECT_ID');
    const clientEmail = this.configService.get<string>('GCP_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('GCP_PRIVATE_KEY');
    const bucketName = this.configService.get<string>('GCP_BUCKET_NAME');
    if (!projectId || !clientEmail || !privateKey || !bucketName) {
      throw new Error(
        'Missing GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY, or GCP_BUCKET_NAME environment variables',
      );
    }
    this.storage = new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });
    this.bucketName = bucketName;
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ publicUrl: string; key: string }> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileName = `${Date.now()}-${file.originalname}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false,
    });

    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
    return { publicUrl, key: fileName };
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.storage.bucket(this.bucketName).file(fileName).delete();
  }

  async downloadFile(fileName: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    const [content] = await file.download();
    return content.toString('utf-8');
  }
}
