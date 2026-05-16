import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../../logto-auth';
import { PnLService } from '../services/pnl.service';
import { PnLContractsListFilterDto } from '../dto/pnl-contracts-list-filter.dto';
import { PnLContractsListResponseDto } from '../dto/pnl-contracts-list-response.dto';

/**
 * FEATURE-038 — paginated contracts list with P&L per row.
 *
 *   GET /api/finance/pnl/contracts
 *     ?period=&dateFrom=&dateTo=
 *     &page=&limit=&sortBy=&sortDir=&q=
 *
 * Admin-only (LogtoAdminGuard class-level — mirror `pnl-dashboard.controller.ts`).
 * Cache `pnl:contracts-list:<filterHash>` TTL 60s (BR-38-08). Invalidate
 * trên mutation `contract.*` + `cost-items.*` via shared flush helper —
 * mirror dashboard cache flush pattern (BR-38-09).
 *
 * Distinct route prefix `finance/pnl` (NOT `finance/dashboard`) → KHÔNG
 * pollute aggregated dashboard endpoint, cho phép độc lập SDK regen.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('finance/pnl')
export class PnLContractsListController {
  constructor(private readonly pnlService: PnLService) {}

  @Get('contracts')
  @ApiOperation({
    summary:
      'F-038 — Paginated list of ACTIVE/COMPLETED contracts with P&L (revenue / cost / profit / margin tier) per row',
  })
  @ApiResponse({ status: 200, type: PnLContractsListResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid filter (limit/sortBy/page/q)' })
  @ApiResponse({ status: 401, description: 'Missing Bearer token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (non-admin)' })
  async getContractsList(
    @Query() filter: PnLContractsListFilterDto,
  ): Promise<PnLContractsListResponseDto> {
    return this.pnlService.getContractsList(filter);
  }
}
