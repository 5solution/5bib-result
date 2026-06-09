import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoFinanceGuard } from '../../logto-auth';
import { PnLService } from '../services/pnl.service';
import { PnLExcelService } from '../services/pnl-excel.service';
import { PnLDashboardFilterDto } from '../dto/dashboard-filter.dto';
import { PnLDashboardResponseDto } from '../dto/dashboard-response.dto';
import { ExcelExportResponseDto } from '../dto/excel-export.dto';

/**
 * F-028 Phase 2 — aggregated P&L dashboard endpoints.
 *
 *   GET  /api/finance/dashboard?period=&groupBy=&dateFrom=&dateTo=
 *   POST /api/finance/dashboard/export/excel
 *
 * Admin-only (LogtoFinanceGuard). Cache 120s `pnl:dashboard:<filterHash>`.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoFinanceGuard)
@Controller('finance/dashboard')
export class PnLDashboardController {
  constructor(
    private readonly pnlService: PnLService,
    private readonly excel: PnLExcelService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Aggregated P&L dashboard (3 chiều: Type / Partner / Month)',
  })
  @ApiResponse({ status: 200, type: PnLDashboardResponseDto })
  async getDashboard(
    @Query() filter: PnLDashboardFilterDto,
  ): Promise<PnLDashboardResponseDto> {
    return this.pnlService.getDashboardData(filter);
  }

  @Post('export/excel')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Export aggregated P&L Excel 5-sheet (Overview / Top profit / Loss / Type / Partner) → signed URL 15min',
  })
  @ApiResponse({ status: 200, type: ExcelExportResponseDto })
  async exportAggregated(
    @Body() filter: PnLDashboardFilterDto,
    @Req() req: any,
  ): Promise<ExcelExportResponseDto> {
    const actor = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.excel.exportAggregated(filter, actor);
  }
}
