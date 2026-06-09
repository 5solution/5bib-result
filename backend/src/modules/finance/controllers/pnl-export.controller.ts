import {
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoFinanceGuard } from '../../logto-auth';
import { PnLExcelService } from '../services/pnl-excel.service';
import { ExcelExportResponseDto } from '../dto/excel-export.dto';

/**
 * F-028 BR-PNL-15 — Excel export single contract (3 sheet).
 *
 * Phase 2 sẽ thêm POST /finance/dashboard/export/excel cho aggregated report.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoFinanceGuard)
@Controller('finance/contracts/:contractId/export')
export class PnLExportController {
  constructor(private readonly excel: PnLExcelService) {}

  @Post('excel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Export P&L Excel single contract → signed URL S3 15min',
  })
  @ApiParam({ name: 'contractId' })
  @ApiResponse({ status: 200, type: ExcelExportResponseDto })
  async exportExcel(
    @Param('contractId') contractId: string,
    @Req() req: any,
  ): Promise<ExcelExportResponseDto> {
    const actor = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.excel.exportSingleContract(contractId, actor);
  }
}
