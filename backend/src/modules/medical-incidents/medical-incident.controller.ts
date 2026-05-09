import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';
import { env } from 'src/config';
import { CurrentUser } from '../logto-auth/current-user.decorator';
import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';
import { LogtoUser } from '../logto-auth/types';
import { Race, RaceDocument } from '../races/schemas/race.schema';
import { CreateIncidentDto } from './dto/create-incident.dto';
import {
  IncidentAttachmentResponseDto,
  IncidentListResponseDto,
  IncidentResponseDto,
  PdfExportResponseDto,
} from './dto/incident-response.dto';
import { ListIncidentsFilterDto } from './dto/list-incidents-filter.dto';
import { PdfExportOptionsDto } from './dto/pdf-export-options.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { MedicalIncidentService } from './services/medical-incident.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { MedicalIncidentSseService } from './services/sse-broadcaster.service';

const ALLOWED_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10MB pre-resize defense in depth
const UPLOAD_URL_TTL = 5 * 60; // 5min for PUT
const READ_URL_TTL = 15 * 60; // 15min for GET

/**
 * F-018 — Medical Incident Tracker (Race Ops Cluster #9 #1).
 *
 * 10 endpoints, all `@UseGuards(LogtoAdminGuard)` (BTC-only MVP per BR-MI-09).
 * SSE endpoint excluded from admin guard's role check via parent class —
 * EventSource cannot send Authorization header so we rely on session cookie
 * via the same proxy that protects the rest of the admin app.
 */
@ApiTags('Medical Incidents')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('admin/races/:raceId/medical-incidents')
export class MedicalIncidentController {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly service: MedicalIncidentService,
    private readonly pdfService: PdfGeneratorService,
    private readonly sse: MedicalIncidentSseService,
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
  ) {
    this.s3 = new S3Client({
      region: env.s3.region,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
    this.bucket = env.s3.bucket;
  }

  private async resolveMongoRaceId(raceId: string): Promise<string> {
    const race = await this.raceModel.findById(raceId).select('_id').lean();
    if (!race) throw new BadRequestException('Race khong ton tai');
    return race._id.toString();
  }

  // 1) LIST
  @Get()
  @ApiOperation({ summary: 'List incidents (filtered, role-gated PII)' })
  @ApiResponse({ status: 200, type: IncidentListResponseDto })
  async list(
    @Param('raceId') raceId: string,
    @Query() filter: ListIncidentsFilterDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<IncidentListResponseDto> {
    return this.service.listIncidents(raceId, filter, user);
  }

  // 2) DETAIL
  @Get(':id')
  @ApiOperation({ summary: 'Incident detail (PII filtered per role)' })
  @ApiResponse({ status: 200, type: IncidentResponseDto })
  async detail(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @CurrentUser() user: LogtoUser,
  ): Promise<IncidentResponseDto> {
    return this.service.getIncident(raceId, id, user);
  }

  // 3) CREATE
  @Post()
  @ApiOperation({ summary: 'Create new medical incident (state=REPORTED)' })
  @ApiResponse({ status: 201, type: IncidentResponseDto })
  async create(
    @Param('raceId') raceId: string,
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<IncidentResponseDto> {
    const mongoRaceId = await this.resolveMongoRaceId(raceId);
    return this.service.createIncident(raceId, mongoRaceId, dto, user);
  }

  // 4) STATE TRANSITION
  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition incident state (forward-only matrix)' })
  @ApiResponse({ status: 200, type: IncidentResponseDto })
  async transitionStatus(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<IncidentResponseDto> {
    return this.service.transitionStatus(raceId, id, dto, user);
  }

  // 5) PHOTO UPLOAD (multipart)
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload photo attachment (client-resized <2MB recommended)',
  })
  @ApiResponse({ status: 201, type: IncidentAttachmentResponseDto })
  async uploadPhoto(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File,
    @CurrentUser() user: LogtoUser,
  ): Promise<IncidentAttachmentResponseDto> {
    if (!photo) throw new BadRequestException('Thieu file photo');
    if (!ALLOWED_PHOTO_MIMES.has(photo.mimetype)) {
      throw new BadRequestException(
        `MIME khong duoc phep: ${photo.mimetype}. Cho phep: jpeg/png/webp`,
      );
    }
    if (photo.size > PHOTO_MAX_BYTES) {
      throw new BadRequestException(
        `File vuot qua 10MB (${photo.size} bytes) - resize client-side truoc`,
      );
    }

    const ts = Date.now();
    const ext = photo.mimetype === 'image/png' ? 'png' : photo.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const s3Key = `medical-attachments/${raceId}/${id}/${ts}.${ext}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: photo.buffer,
        ContentType: photo.mimetype,
        Metadata: {
          incidentId: id,
          uploadedBy: user.userId,
          ts: `${ts}`,
        },
      }),
    );

    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: READ_URL_TTL },
    );

    return {
      s3Key,
      mime: photo.mimetype,
      sizeBytes: photo.size,
      uploadedAt: new Date(ts).toISOString(),
      signedUrl,
    };
  }

  // 6) PDF EXPORT (single or batch)
  @Post('pdf')
  @ApiOperation({
    summary: 'Generate PDF report (sync Phase 1, 30s timeout, >50 batch warning)',
  })
  @ApiResponse({ status: 201, type: PdfExportResponseDto })
  async exportPdf(
    @Param('raceId') raceId: string,
    @Body() options: PdfExportOptionsDto,
  ): Promise<PdfExportResponseDto> {
    const incidents = await this.service.findForPdf(raceId, options.incidentIds);
    return this.pdfService.generatePdf(raceId, incidents, options);
  }

  // 7) AUTO PDF BATCH (race CLOSED hook)
  @Post('auto-pdf-batch')
  @ApiOperation({ summary: 'Auto-generate PDF for all race incidents (race CLOSED)' })
  @ApiResponse({ status: 201, type: PdfExportResponseDto })
  async autoBatch(
    @Param('raceId') raceId: string,
  ): Promise<PdfExportResponseDto> {
    const incidents = await this.service.findForPdf(raceId);
    return this.pdfService.generatePdf(raceId, incidents, {
      includeAppendix: true,
      includeSignature: true,
    });
  }

  // 8) PHOTO SIGNED URL (re-issue read URL)
  @Get(':id/photo-url')
  @ApiOperation({ summary: 'Re-issue 15min signed URL for an attachment' })
  @ApiResponse({ status: 200 })
  async signPhoto(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Query('s3Key') s3Key: string,
  ): Promise<{ signedUrl: string; expiresAtIso: string }> {
    if (!s3Key.startsWith(`medical-attachments/${raceId}/${id}/`)) {
      throw new BadRequestException('s3Key khong khop voi incident');
    }
    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: READ_URL_TTL },
    );
    return {
      signedUrl,
      expiresAtIso: new Date(Date.now() + READ_URL_TTL * 1000).toISOString(),
    };
  }

  // 9) SSE STREAM (Race Director realtime)
  @Sse('stream')
  @ApiOperation({
    summary: 'SSE realtime stream (Race Director alerts + heartbeat)',
  })
  stream(
    @Param('raceId') raceId: string,
  ): Observable<{ type: string; data: string; id: string }> {
    return this.sse.subscribe(raceId);
  }

  // 10) UPLOAD SIGNED URL (for offline-first photo pre-upload)
  @Post(':id/photo-upload-url')
  @ApiOperation({
    summary: 'Issue signed PUT URL (5min) for client-side direct S3 upload',
  })
  @ApiResponse({ status: 201 })
  async signUploadUrl(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Body() body: { mime: string },
  ): Promise<{ signedUrl: string; s3Key: string; expiresAtIso: string }> {
    if (!ALLOWED_PHOTO_MIMES.has(body.mime)) {
      throw new BadRequestException('MIME khong duoc phep');
    }
    const ts = Date.now();
    const ext = body.mime === 'image/png' ? 'png' : body.mime === 'image/webp' ? 'webp' : 'jpg';
    const s3Key = `medical-attachments/${raceId}/${id}/${ts}.${ext}`;
    const signedUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: body.mime,
      }),
      { expiresIn: UPLOAD_URL_TTL },
    );
    return {
      signedUrl,
      s3Key,
      expiresAtIso: new Date(Date.now() + UPLOAD_URL_TTL * 1000).toISOString(),
    };
  }
}
