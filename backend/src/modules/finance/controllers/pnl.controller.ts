import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoFinanceGuard } from '../../logto-auth';
import { PnLService } from '../services/pnl.service';
import { PnLSummaryDto } from '../dto/pnl-response.dto';

/**
 * F-028 — P&L summary per contract (Phase 1).
 * Dashboard aggregated endpoint defer Phase 2.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoFinanceGuard)
@Controller('finance/contracts/:contractId')
export class PnLController {
  constructor(private readonly pnlService: PnLService) {}

  @Get('pnl')
  @ApiOperation({ summary: 'P&L summary per contract (BR-PNL-01 → 07)' })
  @ApiParam({ name: 'contractId' })
  @ApiResponse({ status: 200, type: PnLSummaryDto })
  async summary(@Param('contractId') contractId: string): Promise<PnLSummaryDto> {
    return this.pnlService.getSummary(contractId);
  }
}
