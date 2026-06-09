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
import { FeeBreakdownDto } from '../dto/pnl-response.dto';

/**
 * FEATURE-040 — fee breakdown drill-down endpoint.
 *
 *   GET /api/finance/contracts/:id/fee-breakdown
 *
 * Returns full fee compute breakdown: source attribution + recon contributions
 * + self-compute slice + grossGMV reference. Admin-only (LogtoFinanceGuard).
 * Cache `pnl:fee-breakdown:<contractId>:tenant=<tenantId>` TTL 3600s (BR-40-11).
 *
 * Decision D4 — split into own controller (NEW file) rather than extending
 * `pnl.controller.ts`. Cleaner module org + isolates F-040 surface from F-028
 * existing route group.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoFinanceGuard)
@Controller('finance/contracts')
export class FeeBreakdownController {
  constructor(private readonly pnlService: PnLService) {}

  @Get(':id/fee-breakdown')
  @ApiOperation({
    summary:
      'F-040 — Contract fee breakdown (recon contributions + self-compute slice + grossGMV reference)',
  })
  @ApiParam({ name: 'id', description: 'Contract ObjectId (hex)' })
  @ApiResponse({ status: 200, type: FeeBreakdownDto })
  @ApiResponse({ status: 401, description: 'Missing Bearer token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (non-admin)' })
  @ApiResponse({ status: 404, description: 'Contract not found / deleted' })
  async getFeeBreakdown(@Param('id') id: string): Promise<FeeBreakdownDto> {
    return this.pnlService.getFeeBreakdown(id);
  }
}
