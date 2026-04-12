import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';
import { PreviewReconciliationDto } from './dto/preview-reconciliation.dto';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { UpdateReconciliationStatusDto } from './dto/update-reconciliation-status.dto';

function fmtDate(s: string): string {
  if (!s) return '';
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
}

function buildRecFilename(doc: any, ext: string): string {
  const parts = [
    doc.tenant_name || String(doc.tenant_id),
    doc.race_title,
    `${fmtDate(doc.period_start)} đến ${fmtDate(doc.period_end)}`,
  ].filter(Boolean);
  return `${parts.join(' - ')}.${ext}`;
}

@ApiTags('reconciliations')
@Controller('reconciliations')
@UseGuards(JwtAuthGuard)
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly queryService: ReconciliationQueryService,
    private readonly xlsxService: XlsxService,
    private readonly docxService: DocxService,
  ) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview reconciliation data from MySQL without saving' })
  @ApiResponse({ status: 200, description: 'Preview data returned' })
  preview(@Body() dto: PreviewReconciliationDto) {
    return this.reconciliationService.preview(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new reconciliation, generate XLSX/DOCX, upload to S3' })
  @ApiResponse({ status: 201, description: 'Reconciliation created' })
  create(@Body() dto: CreateReconciliationDto, @Request() req: any) {
    dto.created_by = req.user?.userId ?? req.user?.id ?? 0;
    return this.reconciliationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List reconciliations with optional filters' })
  @ApiResponse({ status: 200, description: 'List of reconciliations' })
  @ApiQuery({ name: 'tenant_id', required: false, type: Number })
  @ApiQuery({ name: 'mysql_race_id', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('tenant_id') tenant_id?: string,
    @Query('mysql_race_id') mysql_race_id?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reconciliationService.findAll({
      tenant_id: tenant_id ? Number(tenant_id) : undefined,
      mysql_race_id: mysql_race_id ? Number(mysql_race_id) : undefined,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('races/:tenantId')
  @ApiOperation({ summary: 'Get races for a tenant from MySQL' })
  @ApiResponse({ status: 200, description: 'List of races' })
  getRaces(@Param('tenantId') tenantId: string) {
    return this.queryService.getRacesByTenant(Number(tenantId));
  }

  @Get(':id/download/xlsx')
  @ApiOperation({ summary: 'Download XLSX file for a reconciliation' })
  @ApiResponse({ status: 200, description: 'XLSX file stream' })
  async downloadXlsx(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.reconciliationService.findOne(id);
    const buf = await this.xlsxService.generate(doc);
    const filename = buildRecFilename(doc, 'xlsx');
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.send(buf);
  }

  @Get(':id/download/docx')
  @ApiOperation({ summary: 'Download DOCX file for a reconciliation' })
  @ApiResponse({ status: 200, description: 'DOCX file stream' })
  async downloadDocx(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.reconciliationService.findOne(id);
    const tenant = await this.queryService.getTenant(doc.tenant_id);
    (doc as any).tenant_metadata = tenant?.metadata ?? {};
    const buf = await this.docxService.generate(doc);
    const filename = buildRecFilename(doc, 'docx');
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.send(buf);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reconciliation by id' })
  @ApiResponse({ status: 200, description: 'Reconciliation document' })
  findOne(@Param('id') id: string) {
    return this.reconciliationService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update reconciliation status' })
  @ApiResponse({ status: 200, description: 'Updated reconciliation' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReconciliationStatusDto,
  ) {
    return this.reconciliationService.updateStatus(id, dto);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate XLSX and/or DOCX files' })
  @ApiResponse({ status: 200, description: 'Regenerated file URLs' })
  regenerate(
    @Param('id') id: string,
    @Body() body: { type: 'xlsx' | 'docx' | 'both' },
  ) {
    return this.reconciliationService.regenerate(id, body.type ?? 'both');
  }
}
