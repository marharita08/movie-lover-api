import { registerAs } from '@nestjs/config';

export const gcpConfig = registerAs('gcp', () => ({
  projectId: process.env.GCP_PROJECT_ID as string,
  bucketName: process.env.GCP_BUCKET_NAME as string,
  clientEmail: process.env.GCP_CLIENT_EMAIL as string,
  privateKey: (process.env.GCP_PRIVATE_KEY as string).replace(/\\n/g, '\n'),
}));
