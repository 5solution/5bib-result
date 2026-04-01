import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../config';

const credentials = {
  accessKeyId: env.s3.accessKeyId,
  secretAccessKey: env.s3.secretAccessKey,
};

const region = env.s3.region;
export const s3ClientProvider = {
  provide: S3Client,
  useValue: new S3Client({ region, credentials }),
};
