import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReconciliationService } from './reconciliation.service';
import { PreviewReconciliationDto } from './dto/preview-reconciliation.dto';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { UpdateReconciliationStatusDto } from './dto/update-reconciliation-status.dto';

@ApiTags('reconciliations')
@Controller('reconciliations')
@UseGuards(JwtAuthGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

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
