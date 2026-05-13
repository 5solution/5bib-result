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
import type { Response } from 'express';
import { ServiceCatalogService } from './services/service-catalog.service';
import { ServiceCatalogImportService } from './services/service-catalog-import.service';
import {
  CreateServiceCatalogDto,
  ServiceCatalogResponseDto,
  UpdateServiceCatalogDto,
} from './dto/service-catalog.dto';
import {
  ServiceCatalogImportConfirmDto,
  ServiceCatalogImportPreviewDto,
  ServiceCatalogImportResultDto,
} from './dto/import-service-catalog.dto';
import { LogtoStaffGuard } from '../logto-auth';

@ApiTags('Service Catalog')
@ApiBearerAuth()
@UseGuards(LogtoStaffGuard)
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(
    private readonly catalog: ServiceCatalogService,
    private readonly importService: ServiceCatalogImportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create catalog item' })
  @ApiResponse({ status: 201, type: ServiceCatalogResponseDto })
  async create(@Body() dto: CreateServiceCatalogDto, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.catalog.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List catalog items' })
  @ApiResponse({ status: 200, type: [ServiceCatalogResponseDto] })
  async list(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.catalog.findAll({ category, search });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE-031 — Excel Import endpoints.
  //
  // CRITICAL: Literal routes "import-excel/*" + "import-template" PHẢI declare
  // TRƯỚC `@Get(':id')` / `@Patch(':id')` / `@Delete(':id')` (F-021 PROD
  // incident lesson — same-method collision với @Get(':id') for GET /import-template).
  // ──────────────────────────────────────────────────────────────────────────

  @Post('import-excel/preview')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @ApiOperation({
    summary:
      'FEATURE-031: Parse + validate Excel import (preview only, KHÔNG insert)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file .xlsx (max 5MB, ≤200 data rows)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: ServiceCatalogImportPreviewDto })
  async importPreview(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ServiceCatalogImportPreviewDto> {
    if (!file) {
      throw new BadRequestException('File required');
    }
    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.xlsx')) {
      throw new BadRequestException('Chỉ chấp nhận file .xlsx');
    }
    return this.importService.parseExcel(file.buffer);
  }

  @Post('import-excel/confirm')
  @ApiOperation({
    summary:
      'FEATURE-031: Confirm Excel import — bulk insert validated rows (server re-validates duplicate)',
  })
  @ApiResponse({ status: 201, type: ServiceCatalogImportResultDto })
  async importConfirm(
    @Body() dto: ServiceCatalogImportConfirmDto,
    @Req() req: any,
  ): Promise<ServiceCatalogImportResultDto> {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.importService.bulkInsert(dto.rows, userId);
  }

  @Get('import-template')
  @ApiOperation({
    summary:
      'FEATURE-031: Download Excel template (7 columns VN headers + 1 example row)',
  })
  @ApiResponse({
    status: 200,
    description: 'XLSX file binary stream',
  })
  async importTemplate(@Res() res: Response): Promise<void> {
    const buf = await this.importService.generateTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="service-catalog-template.xlsx"',
    });
    res.send(buf);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Param routes (declared AFTER literal routes above)
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get catalog item detail' })
  @ApiResponse({ status: 200, type: ServiceCatalogResponseDto })
  async detail(@Param('id') id: string) {
    return this.catalog.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update catalog item' })
  @ApiResponse({ status: 200, type: ServiceCatalogResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateServiceCatalogDto) {
    return this.catalog.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete catalog item' })
  async remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
}
