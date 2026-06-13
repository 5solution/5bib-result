import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import {
  LogtoOrApiKeyWriteGuard,
  RequireScope,
} from '../api-keys/logto-or-api-key-write.guard';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('')
  @UseGuards(LogtoOrApiKeyWriteGuard)
  @RequireScope('upload:write')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          // This key must match the name in FileInterceptor('file')
          type: 'string',
          format: 'binary',
        },
        folder: {
          // FEATURE-083 — optional S3 key prefix (e.g. "landing-assets/<id>").
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const url = await this.uploadService.uploadFile(file, folder);
    if (!url) {
      throw new BadRequestException('Upload failed');
    }
    return { url };
  }
}
