import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LogtoAdminGuard } from '../logto-auth';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { RepeatAthleteService } from './services/repeat-athlete.service';
import { MerchantChurnService } from './services/merchant-churn.service';
import { TimeToFillService } from './services/time-to-fill.service';
import { ClaimRateService } from './services/claim-rate.service';
import { GeographicDemographicService } from './services/geographic-demographic.service';
import { RefundCancelService } from './services/refund-cancel.service';
import {
  RepeatAthleteRateQueryDto,
  RepeatAthleteRateResponseDto,
} from './dto/repeat-athlete-rate.dto';
import {
  MerchantChurnQueryDto,
  MerchantChurnResponseDto,
} from './dto/merchant-churn.dto';
import {
  TimeToFillQueryDto,
  TimeToFillResponseDto,
} from './dto/time-to-fill.dto';
import {
  ClaimRateQueryDto,
  ClaimRateResponseDto,
} from './dto/claim-rate.dto';
import {
  GeoDemoQueryDto,
  GeoDemoResponseDto,
} from './dto/geographic-demographic.dto';
import {
  RefundCancelQueryDto,
  RefundCancelResponseDto,
} from './dto/refund-cancel.dto';
import { PeriodKind, CompareKind } from './services/period-resolver';
// F-058 — Discrepancy check DTO
import {
  DiscrepancyCheckQueryDto,
  DiscrepancyCheckResponseDto,
} from './dto/analytics-discrepancy.dto';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(LogtoAdminGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly repeatAthleteService: RepeatAthleteService,
    private readonly merchantChurnService: MerchantChurnService,
    private readonly timeToFillService: TimeToFillService,
    private readonly claimRateService: ClaimRateService,
    private readonly geoDemoService: GeographicDemographicService,
    private readonly refundCancelService: RefundCancelService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Platform overview — GMV, orders, platform fee, vs last month',
  })
  @ApiResponse({ status: 200, description: 'Overview metrics for the given month' })
  getOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('revenue/daily')
  @ApiOperation({ summary: 'Daily revenue breakdown (GMV + orders per day)' })
  @ApiResponse({
    status: 200,
    description: 'Array of daily revenue data points',
  })
  getDailyRevenue(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDailyRevenue(query);
  }

  @Get('top-races')
  @ApiOperation({ summary: 'Top races by GMV in the given period' })
  @ApiResponse({ status: 200, description: 'List of top races ordered by gross GMV' })
  getTopRaces(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTopRaces(query);
  }

  @Get('revenue-by-category')
  @ApiOperation({ summary: 'Revenue breakdown by order category (ORDINARY, MANUAL, GROUP_BUY, etc.)' })
  @ApiResponse({ status: 200, description: 'Revenue grouped by order category' })
  getRevenueByCategory(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRevenueByCategory(query);
  }

  @Get('races')
  @ApiOperation({
    summary: 'Race performance list — paid/voided orders, runners, GMV, platform fee',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of race performance records' })
  getRacePerformance(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRacePerformance(query);
  }

  @Get('races/:raceId/detail')
  @ApiOperation({ summary: 'Detailed analytics for a single race' })
  @ApiResponse({ status: 200, description: 'Race detail with category breakdown and daily revenue' })
  getRaceDetail(
    @Param('raceId') raceId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRaceDetail(Number(raceId), query);
  }

  @Get('merchants')
  @ApiOperation({
    summary: 'Merchant comparison — GMV, orders, estimated platform fee per tenant',
  })
  @ApiResponse({ status: 200, description: 'List of merchant analytics records' })
  getMerchantComparison(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getMerchantComparison(query);
  }

  @Get('runners/behavior')
  @ApiOperation({
    summary: 'Runner behavior — repeat rate, booking lead time, peak hours/days',
  })
  @ApiResponse({ status: 200, description: 'Runner behavior analytics' })
  getRunnerBehavior(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRunnerBehavior(query);
  }

  @Get('runners/booking-patterns')
  @ApiOperation({ summary: 'Booking heatmap — 7 days × 24 hours grid of order counts' })
  @ApiResponse({ status: 200, description: '7×24 order count matrix indexed by [dow][hour]' })
  getBookingPatterns(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getBookingPatterns(query);
  }

  @Get('funnel')
  @ApiOperation({
    summary: 'Order funnel — paid/voided counts by category, avg time to pay',
  })
  @ApiResponse({ status: 200, description: 'Funnel data grouped by status and category' })
  getFunnel(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getFunnel(query);
  }

  // ─── F-026 — 6 endpoint mới (BR-ANALYTICS-12 → 21) ──────────────────────────

  @Get('repeat-athlete-rate')
  @ApiOperation({
    summary: 'F-026 BR-12 — Repeat athlete rate (12 tháng rolling default)',
  })
  @ApiResponse({ status: 200, type: RepeatAthleteRateResponseDto })
  getRepeatAthleteRate(
    @Query() q: RepeatAthleteRateQueryDto,
  ): Promise<RepeatAthleteRateResponseDto> {
    return this.repeatAthleteService.getRate({
      period: q.period as PeriodKind,
      from: q.from,
      to: q.to,
      compareWith: q.compareWith as CompareKind | undefined,
      raceId: q.raceId,
    });
  }

  @Get('merchant-churn')
  @ApiOperation({
    summary:
      'F-026 BR-13 — Merchant churn (≥6 tháng) + at-risk (4–6 tháng)',
  })
  @ApiResponse({ status: 200, type: MerchantChurnResponseDto })
  getMerchantChurn(
    @Query() q: MerchantChurnQueryDto,
  ): Promise<MerchantChurnResponseDto> {
    return this.merchantChurnService.getChurn({
      period: q.period as PeriodKind,
      from: q.from,
      to: q.to,
    });
  }

  @Get('time-to-fill')
  @ApiOperation({
    summary: 'F-026 BR-14/15 — Time-to-fill + Fill Rate per course',
  })
  @ApiResponse({ status: 200, type: TimeToFillResponseDto })
  getTimeToFill(
    @Query() q: TimeToFillQueryDto,
  ): Promise<TimeToFillResponseDto> {
    return this.timeToFillService.getTimeToFill({
      period: q.period as PeriodKind,
      from: q.from,
      to: q.to,
      raceId: q.raceId,
      courseId: q.courseId,
    });
  }

  @Get('claim-rate')
  @ApiOperation({
    summary: 'F-026 BR-16/17 — Claim rate per race + Resolution SLA 24h',
  })
  @ApiResponse({ status: 200, type: ClaimRateResponseDto })
  getClaimRate(
    @Query() q: ClaimRateQueryDto,
  ): Promise<ClaimRateResponseDto> {
    return this.claimRateService.getClaimRate({
      period: q.period as PeriodKind,
      from: q.from,
      to: q.to,
      raceId: q.raceId,
    });
  }

  @Get('geographic-demographic')
  @ApiOperation({
    summary:
      'F-026 BR-18/19 — Geographic (vùng) + Demographic (gender × age)',
  })
  @ApiResponse({ status: 200, type: GeoDemoResponseDto })
  getGeoDemo(@Query() q: GeoDemoQueryDto): Promise<GeoDemoResponseDto> {
    return this.geoDemoService.getGeoDemo({
      period: q.period as PeriodKind,
      from: q.from,
      to: q.to,
      raceId: q.raceId,
    });
  }

  @Get('refund-cancel-rate')
  @ApiOperation({ summary: 'F-026 BR-20/21 — Refund + Cancel Rate' })
  @ApiResponse({ status: 200, type: RefundCancelResponseDto })
  getRefundCancel(
    @Query() q: RefundCancelQueryDto,
  ): Promise<RefundCancelResponseDto> {
    return this.refundCancelService.getRefundCancel({
      period: q.period as PeriodKind,
      from: q.from,
      to: q.to,
      raceId: q.raceId,
    });
  }

  // ─── F-058 — Discrepancy check (finance ad-hoc reconcile) ─────────────────

  @Get('discrepancy-check')
  @ApiOperation({
    summary:
      'F-058 BR-58-08 — Compare Analytics aggregate vs Reconciliation totals per (tenant, month)',
    description:
      'Finance team ad-hoc reconcile khi nghi ngờ Analytics dashboard lệch so với Reconciliation. Read-only, no cache.',
  })
  @ApiResponse({ status: 200, type: DiscrepancyCheckResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid tenantId/month params' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getDiscrepancyCheck(
    @Query() query: DiscrepancyCheckQueryDto,
  ): Promise<DiscrepancyCheckResponseDto> {
    return this.analyticsService.getDiscrepancyCheck(query);
  }
}
