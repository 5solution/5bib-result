import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { LogtoAdminGuard } from '../logto-auth';
import type { AuthenticatedRequest } from '../logto-auth/types';
import { ResultKioskDisplayService } from './services/result-kiosk-display.service';
import { UpdateDisplayConfigDto } from './dto/display-config.dto';
import {
  ALLOWED_LOGO_MIMES,
  SPONSOR_LOGO_MAX_BYTES,
  SPONSOR_LOGO_S3_PREFIX,
  SponsorLogoUploadResponseDto,
} from './dto/sponsor-logo-upload.dto';
import { env } from 'src/config';

@ApiTags('Result Kiosk Display')
@Controller('result-kiosk-display')
@UseGuards(LogtoAdminGuard)
export class ResultKioskDisplayController {
  constructor(
    private readonly displayService: ResultKioskDisplayService,
    private readonly s3Client: S3Client,
  ) {}

  @Get(':mongoRaceId')
  @ApiOperation({ summary: 'Get or lazy-create display config for race' })
  @ApiParam({ name: 'mongoRaceId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Returns display config doc' })
  async getConfig(@Param('mongoRaceId') mongoRaceId: string) {
    const doc = await this.displayService.getOrCreate(mongoRaceId);
    return { data: doc, success: true };
  }

  @Put(':mongoRaceId')
  @ApiOperation({ summary: 'Update display config' })
  @ApiParam({ name: 'mongoRaceId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Returns updated config' })
  async updateConfig(
    @Param('mongoRaceId') mongoRaceId: string,
    @Body() body: UpdateDisplayConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.sub ?? req.user?.userId ?? 'unknown';
    const doc = await this.displayService.update(mongoRaceId, body, userId);
    return { data: doc, success: true };
  }

  @Patch(':mongoRaceId/preset/:preset')
  @ApiOperation({ summary: 'Reset to a preset (DEFAULT/MINIMAL/PREMIUM)' })
  @ApiParam({ name: 'mongoRaceId', type: 'string' })
  @ApiParam({ name: 'preset', enum: ['DEFAULT', 'MINIMAL', 'PREMIUM'] })
  @ApiResponse({ status: 200 })
  async applyPreset(
    @Param('mongoRaceId') mongoRaceId: string,
    @Param('preset') preset: 'DEFAULT' | 'MINIMAL' | 'PREMIUM',
    @Req() req: AuthenticatedRequest,
  ) {
    if (!['DEFAULT', 'MINIMAL', 'PREMIUM'].includes(preset)) {
      throw new BadRequestException('Invalid preset');
    }
    const userId = req.user?.sub ?? req.user?.userId ?? 'unknown';
    const doc = await this.displayService.resetToPreset(mongoRaceId, preset, userId);
    return { data: doc, success: true };
  }

  @Post(':mongoRaceId/sponsor-logo')
  @ApiOperation({ summary: 'Upload sponsor logo to S3 result-kiosk-sponsors/ prefix' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'mongoRaceId', type: 'string' })
  @ApiResponse({ status: 200, type: SponsorLogoUploadResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SPONSOR_LOGO_MAX_BYTES },
    }),
  )
  async uploadSponsorLogo(
    @Param('mongoRaceId') mongoRaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ): Promise<SponsorLogoUploadResponseDto> {
    if (!file) throw new BadRequestException('No file');
    if (file.size > SPONSOR_LOGO_MAX_BYTES) {
      throw new PayloadTooLargeException('Logo exceeds 2MB limit');
    }
    if (!ALLOWED_LOGO_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid mime ${file.mimetype}. Allowed: ${ALLOWED_LOGO_MIMES.join(', ')}`,
      );
    }
    const userId = req.user?.sub ?? req.user?.userId ?? 'unknown';
    const ext = file.originalname.split('.').pop() || 'png';
    const key = `${SPONSOR_LOGO_S3_PREFIX}/${mongoRaceId}/${randomBytes(8).toString('hex')}.${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`;
    await this.displayService.appendSponsorLogo(mongoRaceId, url, userId);
    return { success: true, url, key };
  }

  @Delete(':mongoRaceId/sponsor-logo')
  @ApiOperation({ summary: 'Remove sponsor logo (URL provided in query)' })
  @ApiParam({ name: 'mongoRaceId', type: 'string' })
  @ApiResponse({ status: 200 })
  async removeSponsorLogo(
    @Param('mongoRaceId') mongoRaceId: string,
    @Query('url') url: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!url) throw new BadRequestException('Missing url query param');
    const userId = req.user?.sub ?? req.user?.userId ?? 'unknown';
    const doc = await this.displayService.removeSponsorLogo(mongoRaceId, url, userId);
    return { data: doc, success: true };
  }
}
