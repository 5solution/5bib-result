import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ContractTemplateService } from './services/contract-template.service';
import { ContractType } from './schemas/contract.schema';
import { LogtoStaffOrFinanceGuard } from '../logto-auth';
import { AuditLogService } from '../audit/services/audit-log.service';
import { Optional } from '@nestjs/common';
import { LineItemTemplate } from './schemas/contract-template.schema';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * F-024 Contract Templates controller.
 *
 * UX-39 v1 (Phase 1): article boilerplate editor.
 * UX-39 v2 (Phase 1.5): rich text editor.
 * UX-39 v3 (Phase A.3): Audit Viewer + Upload DOCX template + Phụ lục editor.
 *
 * Endpoints:
 *   GET    /api/contract-templates                       — list all
 *   GET    /api/contract-templates/:type                 — get by type
 *   GET    /api/contract-templates/:type/default-articles — raw defaults
 *   PATCH  /api/contract-templates/:type                 — upsert articles
 *   POST   /api/contract-templates/:type/reset           — reset articles
 *
 *   [UX-39 v3 NEW]
 *   GET    /api/contract-templates/:type/preview-html    — mammoth render audit viewer
 *   POST   /api/contract-templates/:type/upload          — upload new DOCX
 *   GET    /api/contract-templates/:type/versions        — list backups
 *   POST   /api/contract-templates/:type/restore/:filename — restore backup
 *   GET    /api/contract-templates/:type/line-items      — get default line items
 *   PATCH  /api/contract-templates/:type/line-items      — upsert default line items
 *
 * All endpoints class-level guarded by LogtoStaffOrFinanceGuard per BR-CM-13.
 */
@ApiTags('Contract Templates')
@ApiBearerAuth()
@UseGuards(LogtoStaffOrFinanceGuard)
@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(
    private readonly templates: ContractTemplateService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Existing endpoints (UX-39 v1 + v2)
  // ────────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all contract templates (one per type)' })
  @ApiResponse({ status: 200 })
  async list() {
    return this.templates.list();
  }

  @Get(':type')
  @ApiOperation({
    summary:
      'Get template by contract type (returns synthetic doc with defaults if not yet customized)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async getByType(@Param('type') type: ContractType) {
    return this.templates.getByType(type);
  }

  @Get(':type/default-articles')
  @ApiOperation({
    summary:
      'F-024 UX-39: Get RAW default article boilerplate cho admin editor (key/heading/body, không apply DB override)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async getDefaultArticles(@Param('type') type: ContractType) {
    return { articles: this.templates.getDefaultsForType(type) };
  }

  @Patch(':type')
  @ApiOperation({
    summary:
      'Upsert template articles for a contract type (BR-CM-11 admin edit boilerplate)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async upsert(
    @Param('type') type: ContractType,
    @Body() body: { articles: Record<string, string> },
    @Req() req: any,
  ) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.templates.upsert(type, body.articles, userId);
  }

  @Post(':type/reset')
  @ApiOperation({
    summary:
      'Reset template to default (delete DB override, fallback to constants/default-templates.ts)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async reset(@Param('type') type: ContractType) {
    return this.templates.resetToDefault(type);
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-024 UX-39 v3 Task 1 — Audit Viewer (preview-html endpoint)
  // ────────────────────────────────────────────────────────────────────────

  @Get(':type/preview-html')
  @ApiOperation({
    summary:
      'F-024 UX-39 v3: Render template DOCX → HTML qua mammoth cho Audit Viewer (read-only, fidelity 100%)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({
    status: 200,
    description: 'HTML render từ DOCX template + flag cached',
  })
  async previewHtml(@Param('type') type: ContractType) {
    return this.templates.getPreviewHtml(type);
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-024 UX-39 v3 Task 2 — Upload DOCX template + backup history
  // ────────────────────────────────────────────────────────────────────────

  @Post(':type/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_SIZE },
    }),
  )
  @ApiOperation({
    summary:
      'F-024 UX-39 v3: Upload new DOCX template (validate via docxtemplater dry-run, backup old, invalidate cache, emit audit log)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'DOCX file (max 10MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 201 })
  async uploadTemplate(
    @Param('type') type: ContractType,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File không được cung cấp');
    }
    if (file.mimetype !== DOCX_MIME) {
      throw new BadRequestException(
        `MIME type không hợp lệ — chỉ chấp nhận .docx (received: ${file.mimetype})`,
      );
    }
    const result = await this.templates.uploadTemplate(
      type,
      file.buffer,
      file.originalname ?? 'upload.docx',
    );

    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    if (this.auditLog) {
      try {
        await this.auditLog.emit({
          actor: { userId },
          action: 'contract_template.uploaded',
          entity: {
            type: 'contract_template',
            id: type,
            displayName: `${type} template`,
          },
          metadata: {
            originalFilename: file.originalname,
            size: file.size,
            backupCreated: result.backup?.filename,
          },
        });
      } catch {
        // best-effort
      }
    }
    return result;
  }

  @Get(':type/versions')
  @ApiOperation({
    summary:
      'F-024 UX-39 v3: List backup versions cho a contract type (sorted by timestamp DESC)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async listVersions(@Param('type') type: ContractType) {
    const versions = await this.templates.listBackups(type);
    return { versions };
  }

  @Post(':type/restore/:filename')
  @ApiOperation({
    summary:
      'F-024 UX-39 v3: Restore template từ backup version (validate + backup current trước)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiParam({ name: 'filename' })
  @ApiResponse({ status: 200 })
  async restoreVersion(
    @Param('type') type: ContractType,
    @Param('filename') filename: string,
    @Req() req: any,
  ) {
    const result = await this.templates.restoreBackup(type, filename);
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    if (this.auditLog) {
      try {
        await this.auditLog.emit({
          actor: { userId },
          action: 'contract_template.restored',
          entity: {
            type: 'contract_template',
            id: type,
            displayName: `${type} template`,
          },
          metadata: { restoredFrom: filename },
        });
      } catch {
        // best-effort
      }
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-024 UX-39 v3 Task 3 — Default line items (Phụ lục editor)
  // ────────────────────────────────────────────────────────────────────────

  @Get(':type/line-items')
  @ApiOperation({
    summary:
      'F-024 UX-39 v3: Get default line items template (pre-populate khi tạo HĐ mới)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async getLineItems(@Param('type') type: ContractType) {
    const items = await this.templates.getLineItems(type);
    return { defaultLineItems: items };
  }

  @Patch(':type/line-items')
  @ApiOperation({
    summary:
      'F-024 UX-39 v3: Upsert default line items template (admin define hạng mục mặc định cho HĐ mới)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async updateLineItems(
    @Param('type') type: ContractType,
    @Body() body: { defaultLineItems: LineItemTemplate[] },
    @Req() req: any,
  ) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.templates.updateLineItems(
      type,
      body.defaultLineItems ?? [],
      userId,
    );
  }
}
