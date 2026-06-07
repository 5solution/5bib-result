import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../logto-auth/current-user.decorator';
import { LogtoMerchantFinanceGuard } from '../logto-auth/logto-merchant-finance.guard';
import { LogtoMerchantGuard } from '../logto-auth/logto-merchant.guard';
import type { LogtoUser } from '../logto-auth/types';
import { MerchantMeResponseDto } from './dto/merchant-me.dto';
import {
  MerchantRaceListQueryDto,
  MerchantRaceListResponseDto,
} from './dto/race-list.dto';
import {
  RevenueAggregateDto,
  RevenueByCategoryDto,
} from './dto/revenue-breakdown.dto';
import { RevenueSummaryDto } from './dto/revenue-summary.dto';
import { RevenueTrendDto } from './dto/revenue-trend.dto';
import {
  TicketChartQueryDto,
  TicketOrderListDto,
  TicketOrdersQueryDto,
  TicketStackedDto,
  TicketTrendDto,
} from './dto/ticket-charts.dto';
import {
  TicketSalesBreakdownDto,
  TicketSalesQueryDto,
  TicketSalesSummaryDto,
} from './dto/ticket-sales.dto';
import { MerchantPortalService } from './services/merchant-portal.service';

@ApiTags('Merchant Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoMerchantGuard)
@Controller('merchant-portal')
export class MerchantPortalController {
  constructor(private readonly merchantPortalService: MerchantPortalService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Merchant profile + permissions + assigned race summary (BR-MP-26)',
    description:
      'Trả profile, permission level (drives UI tab visibility), tenant scope, ' +
      'số giải được assign. 404 nếu chưa có access config, 403 nếu inactive.',
  })
  @ApiResponse({ status: 200, type: MerchantMeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'No merchant role OR account inactive' })
  @ApiResponse({ status: 404, description: 'No access config assigned' })
  async getMe(@CurrentUser() user: LogtoUser): Promise<MerchantMeResponseDto> {
    return this.merchantPortalService.getMe(user);
  }

  @Get('races')
  @ApiOperation({
    summary: 'List giải được assign + tổng vé bán (BR-MP-26)',
    description:
      'Race list (title/status/date/ticketsSold). Draft races filtered out ' +
      '(BR-MP-05). Optional tenantId filter cho agency multi-tenant (BR-MP-21). ' +
      'NO financial fields (BR-MP-09).',
  })
  @ApiResponse({ status: 200, type: MerchantRaceListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR tenantId not in user scope' })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getRaces(
    @CurrentUser() user: LogtoUser,
    @Query() query: MerchantRaceListQueryDto,
  ): Promise<MerchantRaceListResponseDto> {
    return this.merchantPortalService.getRaces(user.userId, query.tenantId);
  }

  @Get('ticket-sales/summary')
  @ApiOperation({
    summary: 'Ticket Sales KPI summary (BR-MP-07/08)',
    description:
      'Tổng vé + breakdown theo financial_status (paid/voided/pending, luôn đủ ' +
      '3 cards). All-time per race. NO financial fields (BR-MP-09). 403 nếu raceId ' +
      'ngoài scope (IDOR).',
  })
  @ApiResponse({ status: 200, type: TicketSalesSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR race not accessible' })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getTicketSalesSummary(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketSalesQueryDto,
  ): Promise<TicketSalesSummaryDto> {
    return this.merchantPortalService.getTicketSalesSummary(
      user.userId,
      query.raceId,
    );
  }

  @Get('ticket-sales/by-course')
  @ApiOperation({
    summary: 'Vé bán theo cự ly (course breakdown — BR-MP-07)',
    description:
      'Paid tickets grouped theo race_course (chain oli→om→tt→rc). GROUP BY rc.id ' +
      '(distinct courses có thể trùng label). Sorted ticketCount DESC. NO financial.',
  })
  @ApiResponse({ status: 200, type: TicketSalesBreakdownDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR race not accessible' })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getTicketSalesByCourse(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketSalesQueryDto,
  ): Promise<TicketSalesBreakdownDto> {
    return this.merchantPortalService.getTicketSalesByCourse(
      user.userId,
      query.raceId,
    );
  }

  @Get('ticket-sales/by-type')
  @ApiOperation({
    summary: 'Vé bán theo loại vé (ticket type breakdown — BR-MP-07)',
    description:
      'Paid tickets grouped theo ticket_type (display tt.type_name). Sorted ' +
      'ticketCount DESC. NO financial fields.',
  })
  @ApiResponse({ status: 200, type: TicketSalesBreakdownDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR race not accessible' })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getTicketSalesByType(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketSalesQueryDto,
  ): Promise<TicketSalesBreakdownDto> {
    return this.merchantPortalService.getTicketSalesByType(
      user.userId,
      query.raceId,
    );
  }

  @Get('ticket-sales/trend')
  @ApiOperation({
    summary: 'Xu hướng đăng ký theo thời gian (BR-MP-07 chart #1)',
    description:
      'COUNT đơn paid theo bucket (daily/weekly/monthly) trong period. NO financial.',
  })
  @ApiResponse({ status: 200, type: TicketTrendDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR race not accessible' })
  async getTicketSalesTrend(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketChartQueryDto,
  ): Promise<TicketTrendDto> {
    return this.merchantPortalService.getTicketSalesTrend(
      user.userId,
      query.raceId,
      query.period ?? '30d',
      query.granularity ?? 'daily',
    );
  }

  @Get('ticket-sales/stacked')
  @ApiOperation({
    summary: 'Cơ cấu đăng ký theo cự ly over time — AnStacked (BR-MP-07 chart #2)',
    description:
      'Ticket count (SUM quantity paid) per course × time bucket. courses[] stable ' +
      'order (total DESC). Chain oli→om→tt→rc. NO financial.',
  })
  @ApiResponse({ status: 200, type: TicketStackedDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR race not accessible' })
  async getTicketSalesStacked(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketChartQueryDto,
  ): Promise<TicketStackedDto> {
    return this.merchantPortalService.getTicketSalesStacked(
      user.userId,
      query.raceId,
      query.period ?? '30d',
      query.granularity ?? 'daily',
    );
  }

  @Get('ticket-sales/orders')
  @ApiOperation({
    summary: 'Bảng đơn hàng chi tiết — paginated (BR-MP-07)',
    description:
      'Order id + tên người mua + cự ly + loại vé + số vé + trạng thái + ngày. ' +
      'Filter financialStatus, search tên người mua. NO financial (total_price) ' +
      'NO email/phone (PII).',
  })
  @ApiResponse({ status: 200, type: TicketOrderListDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Inactive OR race not accessible' })
  async getTicketSalesOrders(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketOrdersQueryDto,
  ): Promise<TicketOrderListDto> {
    return this.merchantPortalService.getTicketSalesOrders(
      user.userId,
      query.raceId,
      query.page ?? 1,
      query.pageSize ?? 20,
      query.financialStatus,
      query.search,
    );
  }

  @Get('revenue/summary')
  @UseGuards(LogtoMerchantFinanceGuard)
  @ApiOperation({
    summary: 'Revenue summary cho 1 race — GMV + phí + net (BR-MP-10)',
    description:
      'PERMISSION-GATED: chỉ role `merchant_finance` + config có `revenue_report`. ' +
      'GMV = Σ(total_price − discounts) paid; phí qua FeeService cascade; net = GMV − phí. ' +
      'Viewer (ticket_report only) → 403.',
  })
  @ApiResponse({ status: 200, type: RevenueSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({
    status: 403,
    description:
      'Not merchant_finance role OR config lacks revenue_report OR race not accessible',
  })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getRevenueSummary(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketSalesQueryDto,
  ): Promise<RevenueSummaryDto> {
    return this.merchantPortalService.getRevenueSummary(user.userId, query.raceId);
  }

  @Get('revenue/by-category')
  @UseGuards(LogtoMerchantFinanceGuard)
  @ApiOperation({
    summary: 'Revenue breakdown theo loại phí — Option A 2-group (BR-MP-12)',
    description:
      'Chia GMV/phí/net paid theo `fee_percent` (ORDINARY/GROUP_BUY/…/null) vs ' +
      '`fee_fixed` (MANUAL). Luôn 2 nhóm. Finance-gated. Frontend map groupKey VN.',
  })
  @ApiResponse({ status: 200, type: RevenueByCategoryDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not finance role / no revenue_report / race not accessible' })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getRevenueByCategory(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketSalesQueryDto,
  ): Promise<RevenueByCategoryDto> {
    return this.merchantPortalService.getRevenueByCategory(
      user.userId,
      query.raceId,
    );
  }

  @Get('revenue/aggregate')
  @UseGuards(LogtoMerchantFinanceGuard)
  @ApiOperation({
    summary: 'Cross-tenant revenue aggregate — "Tất cả BTC" (BR-MP-21b)',
    description:
      'Tổng GMV/phí/net + per-tenant breakdown across mọi BTC của agency. ' +
      'Per-tenant FeeService loop (config phí riêng từng tenant). Scoped tới ' +
      'accessible races. Finance-gated.',
  })
  @ApiResponse({ status: 200, type: RevenueAggregateDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not finance role / no revenue_report' })
  @ApiResponse({ status: 404, description: 'No access config' })
  async getRevenueAggregate(
    @CurrentUser() user: LogtoUser,
  ): Promise<RevenueAggregateDto> {
    return this.merchantPortalService.getRevenueAggregate(user.userId);
  }

  @Get('revenue/trend')
  @UseGuards(LogtoMerchantFinanceGuard)
  @ApiOperation({
    summary: 'Revenue trend GMV/phí/net theo thời gian (BR-MP-10/11)',
    description:
      'GMV/fee/net per time bucket (daily/weekly/monthly) trong period. Date ' +
      'filter ở pull layer, FeeService per tenant per bucket. Finance-gated.',
  })
  @ApiResponse({ status: 200, type: RevenueTrendDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not finance role / no revenue_report / race not accessible' })
  async getRevenueTrend(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketChartQueryDto,
  ): Promise<RevenueTrendDto> {
    return this.merchantPortalService.getRevenueTrend(
      user.userId,
      query.raceId,
      query.period ?? '30d',
      query.granularity ?? 'daily',
    );
  }

  @Get('revenue/export')
  @UseGuards(LogtoMerchantFinanceGuard)
  @ApiOperation({
    summary: 'Xuất Excel doanh thu (.xlsx) — Tổng quan + Theo loại phí (BR-MP-11)',
    description:
      'Workbook 2 sheet (Tổng quan doanh thu + Theo loại phí). Finance-gated. ' +
      'Stream attachment. Reuse revenue summary + by-category.',
  })
  @ApiResponse({ status: 200, description: 'File .xlsx stream' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not finance role / no revenue_report / race not accessible' })
  async getRevenueExport(
    @CurrentUser() user: LogtoUser,
    @Query() query: TicketSalesQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, mimeType } =
      await this.merchantPortalService.getRevenueExport(user.userId, query.raceId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
