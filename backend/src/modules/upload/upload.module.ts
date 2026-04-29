import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { s3ClientProvider } from '../aws.config';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule],
  controllers: [UploadController],
  providers: [UploadService, s3ClientProvider],
  exports: [UploadService],
})
export class UploadModule {}
