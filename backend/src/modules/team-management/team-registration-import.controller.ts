import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import {
  ConfirmImportRegistrationsDto,
  ConfirmImportRegistrationsResponseDto,
  ImportRegistrationsPreviewResponseDto,
} from './dto/import-registrations.dto';
import { TeamRegistrationImportService } from './services/team-registration-import.service';


function identifyAdmin(req: AuthenticatedRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

@ApiTags('Team Registration Import (admin)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management/events/:eventId/registrations/import')
export class TeamRegistrationImportController {
  constructor(private readonly svc: TeamRegistrationImportService) {}

  @Get('template')
  @ApiOperation({
    summary:
      'Download XLSX template for bulk registration import. Includes Roles + Banks + Stations (v1.6) reference sheets and dropdown validations. Station columns (station_id / station_name / assignment_role) are optional — if set, admin imports the TNV AND assigns them to the station in one step.',
  })
  @ApiResponse({
    status: 200,
    description: 'Binary XLSX file (application/vnd.openxmlformats-...).',
  })
  async downloadTemplate(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.svc.generateTemplateXlsx(eventId);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="registration-import-template-event-${eventId}.xlsx"`,
      'Content-Length': String(buf.length),
    });
    res.send(buf);
  }

  @Post('preview')
  @ApiOperation({
    summary:
      'Parse & validate an XLSX/CSV of registrations — returns preview, does NOT insert. Stores parsed rows under an import_token (10-min TTL) for the /confirm call.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: ImportRegistrationsPreviewResponseDto })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = new Set([
          'text/csv',
          'application/csv',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ]);
        const name = (file.originalname ?? '').toLowerCase();
        const extOk = name.endsWith('.csv') || name.endsWith('.xlsx');
        if (!extOk || !allowed.has(file.mimetype ?? '')) {
          return cb(
            new BadRequestException('Chỉ hỗ trợ .csv và .xlsx'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  preview(
    @Param('eventId', ParseIntPipe) eventId: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportRegistrationsPreviewResponseDto> {
    return this.svc.preview(eventId, file);
  }

  @Post('confirm')
  @ApiOperation({
    summary:
      'Commit the parsed import using the import_token from /preview. Skips invalid/duplicate rows.',
  })
  @ApiResponse({ status: 201, type: ConfirmImportRegistrationsResponseDto })
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  confirm(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ConfirmImportRegistrationsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ConfirmImportRegistrationsResponseDto> {
    return this.svc.confirmImport(eventId, dto, identifyAdmin(req));
  }

  @Post('/resend-invite/:regId')
  @ApiOperation({
    summary:
      'Resend welcome/invite email to a single imported registration with dynamic missing-fields list.',
  })
  @ApiResponse({ status: 201 })
  // v037+ — throttle 5 resend per minute per IP. Admin có thể spam click
  // → tránh bombarding TNV email + protect Mailchimp rate limit.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resendInvite(
    @Param('regId', ParseIntPipe) regId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.svc.resendImportInvite(regId, identifyAdmin(req));
    return { success: true };
  }
}
