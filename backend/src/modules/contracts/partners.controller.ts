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
import { PartnersService } from './services/partners.service';
import { PartnersImportService } from './services/partners-import.service';
import {
  CreatePartnerDto,
  PartnerResponseDto,
  UpdatePartnerDto,
} from './dto/partner.dto';
import {
  PartnerImportConfirmDto,
  PartnerImportPreviewDto,
  PartnerImportResultDto,
} from './dto/import-partner.dto';
import { LogtoStaffOrFinanceGuard } from '../logto-auth';

@ApiTags('Partners')
@ApiBearerAuth()
@UseGuards(LogtoStaffOrFinanceGuard)
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly partners: PartnersService,
    private readonly importService: PartnersImportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create partner' })
  @ApiResponse({ status: 201, type: PartnerResponseDto })
  async create(@Body() dto: CreatePartnerDto, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.partners.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List partners' })
  async list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partners.findAll({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE-032 — Excel Import endpoints.
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
      'FEATURE-032: Parse + validate Excel import (preview only, KHÔNG insert)',
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
  @ApiResponse({ status: 200, type: PartnerImportPreviewDto })
  async importPreview(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PartnerImportPreviewDto> {
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
      'FEATURE-032: Confirm Excel import — bulk insert validated rows (server re-validates duplicate)',
  })
  @ApiResponse({ status: 201, type: PartnerImportResultDto })
  async importConfirm(
    @Body() dto: PartnerImportConfirmDto,
    @Req() req: any,
  ): Promise<PartnerImportResultDto> {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.importService.bulkInsert(dto.rows, userId);
  }

  @Get('import-template')
  @ApiOperation({
    summary:
      'FEATURE-032: Download Excel template (11 columns VN headers + 1 example row)',
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
      'Content-Disposition': 'attachment; filename="partners-template.xlsx"',
    });
    res.send(buf);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Param routes (declared AFTER literal routes above)
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get partner detail' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  async detail(@Param('id') id: string) {
    return this.partners.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update partner' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete partner (rejected if has contracts)' })
  async remove(@Param('id') id: string) {
    return this.partners.remove(id);
  }
}
