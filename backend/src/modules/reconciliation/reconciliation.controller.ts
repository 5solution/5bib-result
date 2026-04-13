import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
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
import { ReconciliationPreflightService } from './services/reconciliation-preflight.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';
import { BatchExportService } from './export/batch-export.service';
import { PreviewReconciliationDto } from './dto/preview-reconciliation.dto';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { UpdateReconciliationStatusDto } from './dto/update-reconciliation-status.dto';
import { BatchCreateReconciliationDto } from './dto/batch-create-reconciliation.dto';
import { ExportZipByIdsDto, ExportZipByPeriodDto } from './dto/export-zip.dto';

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
    private readonly preflightService: ReconciliationPreflightService,
    private readonly xlsxService: XlsxService,
    private readonly docxService: DocxService,
    private readonly batchExportService: BatchExportService,
  ) {}

  @Get('preflight')
  @ApiOperation({ summary: 'Pre-flight check for a single merchant + period' })
  @ApiResponse({ status: 200, description: 'Pre-flight result with warnings' })
  @ApiQuery({ name: 'merchant_id', required: true, type: Number })
  @ApiQuery({ name: 'period', required: true, type: String, description: 'YYYY-MM' })
  @ApiQuery({ name: 'race_id', required: false, type: Number })
  preflight(
    @Query('merchant_id') merchant_id: string,
    @Query('period') period: string,
    @Query('race_id') race_id?: string,
  ) {
    return this.preflightService.run(
      Number(merchant_id),
      period,
      race_id ? Number(race_id) : undefined,
    );
  }

  @Post('preflight/batch')
  @ApiOperation({ summary: 'Batch pre-flight check for multiple merchants' })
  @ApiResponse({ status: 200, description: 'Pre-flight results for all merchants' })
  async preflightBatch(
    @Body() body: { period: string; merchant_ids: number[] | 'all' },
  ) {
    let merchantIds: number[];
    if (body.merchant_ids === 'all') {
      merchantIds = await this.reconciliationService.getAllMerchantIds();
    } else {
      merchantIds = body.merchant_ids;
    }
    const results = await Promise.all(
      merchantIds.map((id) => this.preflightService.run(id, body.period)),
    );
    return results;
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch create reconciliations for multiple merchants' })
  @ApiResponse({ status: 201 })
  batchCreate(@Body() dto: BatchCreateReconciliationDto) {
    return this.reconciliationService.batchCreate(dto);
  }

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

  // ── Export ZIP endpoints ──────────────────────────────────────────────

  @Post('export/zip/by-ids')
  @ApiOperation({ summary: 'Trigger async ZIP export for selected reconciliation IDs' })
  @ApiResponse({ status: 201, description: 'Export job created' })
  exportByIds(@Body() dto: ExportZipByIdsDto) {
    return this.batchExportService.triggerByIds(dto.ids, dto.label);
  }

  @Post('export/zip/by-period')
  @ApiOperation({ summary: 'Trigger async ZIP export for all reconciliations in a period' })
  @ApiResponse({ status: 201, description: 'Export job created' })
  exportByPeriod(@Body() dto: ExportZipByPeriodDto) {
    return this.batchExportService.triggerByPeriod(
      dto.periodStart,
      dto.periodEnd,
      dto.label,
    );
  }

  @Get('export-jobs/:jobId')
  @ApiOperation({ summary: 'Get export job status' })
  @ApiResponse({ status: 200, description: 'Job status with progress' })
  async getExportJob(@Param('jobId') jobId: string) {
    const job = await this.batchExportService.getJobStatus(jobId);
    if (!job) throw new NotFoundException(`Export job ${jobId} not found`);
    return job;
  }

  @Get('export-jobs/:jobId/download')
  @ApiOperation({ summary: 'Download ZIP file' })
  @ApiResponse({ status: 200, description: 'ZIP file stream or redirect to S3' })
  async downloadExportJob(@Param('jobId') jobId: string, @Res() res: Response) {
    const job = await this.batchExportService.getJobStatus(jobId);
    if (!job) throw new NotFoundException(`Export job ${jobId} not found`);
    if (job.status !== 'done' || !job.zipUrl) {
      return res.status(400).json({ message: 'Export not ready yet', status: job.status });
    }

    if (job.isLocal) {
      const buf = await this.batchExportService.getLocalZipBuffer(jobId);
      if (!buf) return res.status(404).json({ message: 'Local ZIP file not found' });
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="batch_doi_soat.zip"`,
        'Content-Length': buf.length,
      });
      return res.send(buf);
    }

    // Fetch the S3 URL server-side and pipe back with explicit Content-Disposition
    // so the browser always downloads rather than opening the file.
    const s3Res = await fetch(job.zipUrl);
    if (!s3Res.ok) {
      return res.status(502).json({ message: `Failed to fetch ZIP from S3: HTTP ${s3Res.status}` });
    }
    const buf = Buffer.from(await s3Res.arrayBuffer());
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="batch_doi_soat.zip"`,
      'Content-Length': buf.length,
    });
    return res.send(buf);
  }

  // ── End Export ZIP endpoints ──────────────────────────────────────────

  @Get('cron-logs')
  @ApiOperation({ summary: 'Get recent reconciliation cron run logs' })
  @ApiResponse({ status: 200, description: 'Recent cron logs' })
  getCronLogs() {
    return this.reconciliationService.getCronLogs();
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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a reconciliation record' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  delete(@Param('id') id: string) {
    return this.reconciliationService.delete(id);
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
