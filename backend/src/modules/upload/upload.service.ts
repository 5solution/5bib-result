import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from 'src/config';

const BUCKET_NAME = env.s3.bucket;
const REGION = env.s3.region;

@Injectable()
export class UploadService {
  constructor(private readonly s3Client: S3Client) {}

  async uploadFile(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<string | false> {
    if (!file)
      throw new BadRequestException(
        'No file uploaded. Send as multipart/form-data with field name "file"',
      );
    try {
      const randomString = Math.random().toString(36).substring(2, 15);
      // FEATURE-083 — optional `folder` prefix (e.g. `landing-assets/<id>`).
      // Sanitize: strip path-traversal + disallowed chars. Falls back to the
      // date prefix when omitted (backward-compat for all existing callers).
      const safeFolder = folder
        ?.replace(/\.\.+/g, '')
        .replace(/[^a-zA-Z0-9._/-]/g, '')
        .replace(/^\/+|\/+$/g, '');
      let prefix: string;
      if (safeFolder) {
        prefix = safeFolder;
      } else {
        const now = new Date();
        prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      const key = `${prefix}/${randomString}-${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      const url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
      return url;
    } catch (err) {
      console.error('S3 upload error:', err);
      return false;
    }
  }
}
