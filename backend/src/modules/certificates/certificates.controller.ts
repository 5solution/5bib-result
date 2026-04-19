import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CertificateTemplateService } from './services/certificate-template.service';
import { RaceCertificateConfigService } from './services/race-certificate-config.service';
import {
  CertificateRenderService,
  RenderData,
} from './services/certificate-render.service';
import { RaceResultService } from '../race-result/services/race-result.service';
import { RacesService } from '../races/races.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import {
  TemplateListResponseDto,
  TemplateResponseDto,
} from './dto/template-response.dto';
import { UpsertRaceConfigDto } from './dto/upsert-race-config.dto';
import { RaceConfigResponseDto } from './dto/race-config-response.dto';
import { RenderQueryDto } from './dto/render-query.dto';

@ApiTags('Certificates')
@Controller()
export class CertificatesController {
  constructor(
    private readonly templateService: CertificateTemplateService,
    private readonly configService: RaceCertificateConfigService,
    private readonly renderService: CertificateRenderService,
    private readonly raceResultService: RaceResultService,
    private readonly racesService: RacesService,
  ) {}

  // ─── Admin: CertificateTemplate CRUD ──────────────────────────

  @Post('certificate-templates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a certificate template (admin)' })
  @ApiResponse({ status: 201, type: TemplateResponseDto })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Get('certificate-templates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List certificate templates with filters (admin)' })
  @ApiResponse({ status: 200, type: TemplateListResponseDto })
  listTemplates(@Query() query: ListTemplatesQueryDto) {
    return this.templateService.list(query);
  }

  @Get('certificate-templates/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get certificate template by id (admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TemplateResponseDto })
  @ApiResponse({ status: 404 })
  getTemplate(@Param('id') id: string) {
    return this.templateService.findById(id);
  }

  @Patch('certificate-templates/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update certificate template (admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TemplateResponseDto })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete('certificate-templates/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete certificate template (admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'Template in use by a race config' })
  removeTemplate(@Param('id') id: string) {
    return this.templateService.remove(id);
  }

  // ─── Admin: RaceCertificateConfig ─────────────────────────────

  @Get('race-certificate-configs/:raceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get race certificate config (admin)' })
  @ApiParam({ name: 'raceId' })
  @ApiResponse({ status: 200, type: RaceConfigResponseDto })
  @ApiResponse({ status: 404 })
  async getRaceConfig(@Param('raceId') raceId: string) {
    const config = await this.configService.getByRaceId(raceId);
    if (!config) throw new NotFoundException('Race config not found');
    return config;
  }

  @Put('race-certificate-configs/:raceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert race certificate config (admin)' })
  @ApiParam({ name: 'raceId' })
  @ApiResponse({ status: 200, type: RaceConfigResponseDto })
  upsertRaceConfig(
    @Param('raceId') raceId: string,
    @Body() dto: UpsertRaceConfigDto,
  ) {
    return this.configService.upsert(raceId, dto);
  }

  // ─── Public: Render PNG ───────────────────────────────────────

  @Get('certificates/render/:raceId/:bib')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary:
      'Render a certificate or share card PNG for a specific athlete (public)',
  })
  @ApiParam({ name: 'raceId' })
  @ApiParam({ name: 'bib' })
  @ApiQuery({ name: 'type', enum: ['certificate', 'share_card'] })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiResponse({ status: 200, description: 'PNG binary' })
  @ApiResponse({ status: 404, description: 'Template or athlete not found' })
  async renderCertificate(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
    @Query() query: RenderQueryDto,
    @Res() res: Response,
  ) {
    if (!raceId || !bib) {
      throw new BadRequestException('raceId and bib are required');
    }

    const athlete = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!athlete) {
      throw new NotFoundException('Athlete not found for this race/bib');
    }

    // Course ID resolution: explicit query > athlete.course_id from result data
    const courseId = query.courseId ?? athlete.course_id ?? undefined;

    const templateId = await this.configService.resolveTemplateId(
      raceId,
      courseId,
      query.type,
    );
    if (!templateId) {
      throw new NotFoundException(
        'No template configured for this race/course/type',
      );
    }

    const template = await this.templateService.findByIdRaw(
      templateId.toString(),
    );
    if (!template || template.is_archived) {
      throw new NotFoundException('Template is missing or archived');
    }

    const raceRes = await this.racesService.getRaceById(raceId);
    const race =
      raceRes && raceRes.success && raceRes.data
        ? (raceRes.data as { title?: string; startDate?: Date })
        : null;

    const data: RenderData = {
      runner_name: athlete.Name,
      bib: athlete.Bib,
      finish_time: athlete.ChipTime,
      pace: athlete.Pace,
      distance: athlete.distance,
      event_name: race?.title ?? '',
      event_date: race?.startDate
        ? new Date(race.startDate).toISOString().slice(0, 10)
        : '',
      nation: athlete.Nation ?? athlete.Nationality ?? '',
      gender_rank: athlete.GenderRank ?? '',
      ag_rank: athlete.CatRank ?? '',
      overall_rank: athlete.OverallRank ?? '',
      runner_photo_url: athlete.avatarUrl ?? null,
    };

    const png = await this.renderService.render(template, data, {
      includePhoto: query.includePhoto,
    });

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': png.length.toString(),
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `inline; filename="${query.type}-${bib}.png"`,
    });
    res.send(png);
  }

  @Get('certificates/render-meta/:raceId/:bib')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary:
      'Return canvas size + photo_area bounds for client-side photo compositing (public)',
  })
  @ApiParam({ name: 'raceId' })
  @ApiParam({ name: 'bib' })
  @ApiQuery({ name: 'type', enum: ['certificate', 'share_card'] })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        canvas: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
        photo_area: {
          type: 'object',
          nullable: true,
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            borderRadius: { type: 'number' },
          },
        },
        photo_behind_background: { type: 'boolean' },
        placeholder_photo_url: { type: 'string', nullable: true },
        default_photo_url: { type: 'string', nullable: true },
      },
    },
  })
  async renderMeta(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
    @Query() query: RenderQueryDto,
  ) {
    if (!raceId || !bib) {
      throw new BadRequestException('raceId and bib are required');
    }

    const athlete = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!athlete) throw new NotFoundException('Athlete not found');

    const courseId = query.courseId ?? athlete.course_id ?? undefined;
    const templateId = await this.configService.resolveTemplateId(
      raceId,
      courseId,
      query.type,
    );
    if (!templateId) {
      throw new NotFoundException('No template configured');
    }
    const template = await this.templateService.findByIdRaw(
      templateId.toString(),
    );
    if (!template || template.is_archived) {
      throw new NotFoundException('Template missing or archived');
    }

    // Effective photo bounds: prefer top-level photo_area, fall back to the
    // first "photo" layer's bounds. The admin editor currently creates photo
    // layers (type=photo) rather than setting the top-level photo_area, so
    // both paths need to work for the client compositor.
    let effectivePhotoArea:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
          borderRadius: number;
        }
      | null = null;

    if (template.photo_area) {
      effectivePhotoArea = {
        x: template.photo_area.x,
        y: template.photo_area.y,
        width: template.photo_area.width,
        height: template.photo_area.height,
        borderRadius: template.photo_area.borderRadius ?? 0,
      };
    } else if (Array.isArray(template.layers)) {
      const photoLayer = template.layers.find(
        (l) =>
          l.type === 'photo' &&
          typeof l.width === 'number' &&
          typeof l.height === 'number' &&
          l.width > 0 &&
          l.height > 0,
      );
      if (photoLayer) {
        effectivePhotoArea = {
          x: photoLayer.x,
          y: photoLayer.y,
          width: photoLayer.width as number,
          height: photoLayer.height as number,
          borderRadius: photoLayer.photoBorderRadius ?? 0,
        };
      }
    }

    return {
      canvas: {
        width: template.canvas.width,
        height: template.canvas.height,
      },
      photo_area: effectivePhotoArea,
      photo_behind_background: template.photo_behind_background ?? false,
      placeholder_photo_url: template.placeholder_photo_url ?? null,
      default_photo_url: athlete.avatarUrl ?? null,
    };
  }

  @Get('certificates/check/:raceId')
  @ApiOperation({
    summary:
      'Check which template types are available for a race/course (public)',
  })
  @ApiParam({ name: 'raceId' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        hasCertificate: { type: 'boolean' },
        hasShareCard: { type: 'boolean' },
        certificateHasPhotoArea: { type: 'boolean' },
      },
    },
  })
  async checkAvailability(
    @Param('raceId') raceId: string,
    @Query('courseId') courseId?: string,
  ) {
    const [certId, shareId] = await Promise.all([
      this.configService.resolveTemplateId(raceId, courseId, 'certificate'),
      this.configService.resolveTemplateId(raceId, courseId, 'share_card'),
    ]);

    let certificateHasPhotoArea = false;
    if (certId) {
      const certTpl = await this.templateService.findByIdRaw(certId.toString());
      if (certTpl && !certTpl.is_archived) {
        if (certTpl.photo_area) {
          certificateHasPhotoArea = true;
        } else if (
          Array.isArray(certTpl.layers) &&
          certTpl.layers.some((l) => l.type === 'photo')
        ) {
          certificateHasPhotoArea = true;
        }
      }
    }

    return {
      hasCertificate: !!certId,
      hasShareCard: !!shareId,
      certificateHasPhotoArea,
    };
  }
}
