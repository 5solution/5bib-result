import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ContractsService } from './services/contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractFilterDto } from './dto/contract-filter.dto';
import {
  ContractResponseDto,
  PaginatedContractsDto,
} from './dto/contract-response.dto';
import {
  CreateAcceptanceReportDto,
  CreatePaymentRequestDto,
} from './dto/acceptance-payment.dto';
import { LogtoAdminGuard } from '../logto-auth';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Create contract or quotation' })
  @ApiResponse({ status: 201, type: ContractResponseDto })
  async create(@Body() dto: CreateContractDto, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.contracts.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List contracts with filter + pagination' })
  @ApiResponse({ status: 200, type: PaginatedContractsDto })
  async list(@Query() filter: ContractFilterDto) {
    return this.contracts.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract detail' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async detail(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contract (DRAFT only)' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contracts.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete contract' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string, @Req() req: any) {
    const actorId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.contracts.remove(id, actorId);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate DRAFT contract → ACTIVE' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async activate(@Param('id') id: string) {
    return this.contracts.activate(id);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @ApiOperation({ summary: 'Convert ACCEPTED quotation → new contract' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async convert(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.contracts.convertQuotation(id, userId);
  }

  @Post(':id/acceptance-report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create or update acceptance report (DRAFT)' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async upsertAcceptance(
    @Param('id') id: string,
    @Body() dto: CreateAcceptanceReportDto,
  ) {
    return this.contracts.upsertAcceptanceReport(id, dto);
  }

  @Post(':id/acceptance-report/finalize')
  @HttpCode(200)
  @ApiOperation({ summary: 'Finalize acceptance report' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async finalizeAcceptance(@Param('id') id: string) {
    return this.contracts.finalizeAcceptanceReport(id);
  }

  @Post(':id/payment-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create payment request' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async upsertPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentRequestDto,
  ) {
    return this.contracts.upsertPaymentRequest(id, dto);
  }

  @Patch(':id/payment-request/mark-paid')
  @ApiOperation({ summary: 'Mark payment as PAID — moves contract → COMPLETED' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async markPaid(@Param('id') id: string) {
    return this.contracts.markPaymentPaid(id);
  }

  // ────────────────────────────────────────────────────────────────
  // BR-CM-12: Document generation + download
  // ────────────────────────────────────────────────────────────────

  @Post(':id/generate/:docType')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Render DOCX + PDF (LibreOffice) + upload S3 + push generatedDocuments',
  })
  @ApiParam({
    name: 'docType',
    enum: ['CONTRACT', 'QUOTATION', 'ACCEPTANCE_REPORT', 'PAYMENT_REQUEST'],
  })
  @ApiResponse({
    status: 200,
    description: 'Generated document signed URLs (15min TTL)',
    schema: {
      type: 'object',
      properties: {
        docxKey: { type: 'string' },
        docxUrl: { type: 'string' },
        pdfKey: { type: 'string', nullable: true },
        pdfUrl: { type: 'string', nullable: true },
      },
    },
  })
  async generateDocument(
    @Param('id') id: string,
    @Param('docType') docType: string,
    @Req() req: any,
  ) {
    const allowed = [
      'CONTRACT',
      'QUOTATION',
      'ACCEPTANCE_REPORT',
      'PAYMENT_REQUEST',
    ];
    if (!allowed.includes(docType)) {
      throw new BadRequestException(
        `Invalid docType — must be one of ${allowed.join(', ')}`,
      );
    }
    const actorId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.contracts.generateDocument(id, docType as any, actorId);
  }

  @Get(':id/download')
  @ApiOperation({
    summary:
      'Return a signed S3 URL (15min TTL) for an already-generated document. ' +
      'Pass s3Key as query param (returned from POST /generate/:docType).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
    },
  })
  async getDownloadUrl(
    @Param('id') id: string,
    @Query('s3Key') s3Key: string,
  ) {
    if (!s3Key) throw new BadRequestException('s3Key query param required');
    const url = await this.contracts.getDownloadUrl(id, s3Key);
    return { url };
  }

  @Get(':id/download/stream')
  @ApiOperation({
    summary:
      'Stream a generated document body from S3 (admin proxy, useful when ' +
      'cross-origin signed URL is awkward). Pass s3Key as query param.',
  })
  async streamDownload(
    @Param('id') id: string,
    @Query('s3Key') s3Key: string,
    @Res() res: Response,
  ) {
    if (!s3Key) throw new BadRequestException('s3Key query param required');
    const { body, contentType, filename } = await this.contracts.downloadDocument(
      id,
      s3Key,
    );
    // L-01 QC fix: escape filename theo RFC 5987 — UTF-8 + percent-encoded
    // (defense-in-depth khi filename chứa ký tự đặc biệt / non-ASCII / quote).
    const safeFilename = encodeURIComponent(filename).replace(/['()]/g, escape);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    );
    res.setHeader('Content-Length', String(body.length));
    res.send(body);
  }
}
