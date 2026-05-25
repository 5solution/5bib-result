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
// F-062 Wave 2B-1 — Revenue (weekly/monthly/comparison) DTOs
import { WeeklyRevenuePointDto } from './dto/weekly-revenue.dto';
import { MonthlyRevenuePointDto } from './dto/monthly-revenue.dto';
import {
  ComparisonQueryDto,
  ComparisonResponseDto,
} from './dto/comparison.dto';
// F-062 Wave 2B-2 — Merchant Comparison (scatter / health-distribution / table) DTOs + service
import { MerchantComparisonService } from './services/merchant-comparison.service';
import { MerchantScatterPointDto } from './dto/merchant-scatter.dto';
import { MerchantHealthDistributionTierDto } from './dto/merchant-health-distribution.dto';
import { MerchantComparisonResponseDto } from './dto/merchant-comparison-table.dto';

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
    // F-062 Wave 2B-2 — Merchant comparison (scatter / health-distribution / table)
    private readonly merchantComparisonService: MerchantComparisonService,
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

  // ─── F-062 Wave 2B-1 — Weekly / Monthly / Comparison revenue ───────────────

  @Get('revenue/weekly')
  @ApiOperation({
    summary:
      'F-062 BR-SA-02 v3 — Weekly revenue bucketed by ISO 8601 week (Monday start)',
    description:
      'Group by YEARWEEK(payment_on, 3). Per-bucket platformFee via FeeService Tier 0 cascade. ' +
      'Bucket key format YYYY-Www. Cache 15min (current) / 24h (historical).',
  })
  @ApiResponse({ status: 200, type: WeeklyRevenuePointDto, isArray: true })
  @ApiResponse({ status: 400, description: 'Date range exceeds 366 days' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getWeeklyRevenue(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getWeeklyRevenue(query);
  }

  @Get('revenue/monthly')
  @ApiOperation({
    summary: 'F-062 BR-SA-03 v3 — Monthly revenue bucketed by calendar month',
    description:
      'Group by DATE_FORMAT(payment_on, "%Y-%m"). Per-bucket platformFee via FeeService Tier 0 cascade. ' +
      'Bucket key format YYYY-MM. Cache 15min (current) / 24h (historical).',
  })
  @ApiResponse({ status: 200, type: MonthlyRevenuePointDto, isArray: true })
  @ApiResponse({ status: 400, description: 'Date range exceeds 366 days' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getMonthlyRevenue(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getMonthlyRevenue(query);
  }

  @Get('comparison')
  @ApiOperation({
    summary:
      'F-062 BR-SA-04 v3 — Period-over-period comparison (wow/mom/yoy)',
    description:
      'Current vs previous summary cho 4 metric (gmv/netGmv/platformFee/orderCount). ' +
      'Delta % nullable khi base=0 (calcDeltaPercent guard). ' +
      'mom dùng Wave 2A shiftMonthClamped (handle 31→30 boundary). ' +
      'Mounted at /analytics/comparison per BR-SA-04 line 200 (NOT /revenue/comparison).',
  })
  @ApiResponse({ status: 200, type: ComparisonResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid compareWith or date range' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getRevenueComparison(@Query() query: ComparisonQueryDto) {
    return this.analyticsService.getComparison(query, query.compareWith);
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
    description:
      'LEGACY F-026 endpoint — flat array, no totals. ' +
      'F-062 Wave 2B-2 NEW endpoints at /merchants/scatter, /merchants/health-distribution, /merchants/comparison (BR-SA-22 a/b/c).',
  })
  @ApiResponse({ status: 200, description: 'List of merchant analytics records' })
  getMerchantComparison(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getMerchantComparison(query);
  }

  // ─── F-062 Wave 2B-2 — Merchant Comparison Analytics (BR-SA-22) ─────────────

  @Get('merchants/scatter')
  @ApiOperation({
    summary:
      'F-062 BR-SA-22a v3 — Merchant scatter chart (x=orders, y=gmv, size=gmv)',
    description:
      'Mỗi merchant = 1 bubble. Status drives quadrant labeling (★ HIGH VALUE top-right, ⚠ LOW ACTIVITY bottom-left). ' +
      'Default 12 tháng gần nhất nếu không truyền from/to. ' +
      'Cache `analytics:metric:merchant-comp-scatter:<scope>:<periodKey>` TTL 15min/24h.',
  })
  @ApiResponse({
    status: 200,
    type: MerchantScatterPointDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Date range exceeds 366 days' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getMerchantScatter(@Query() query: AnalyticsQueryDto) {
    return this.merchantComparisonService.getScatter(query);
  }

  @Get('merchants/health-distribution')
  @ApiOperation({
    summary:
      'F-062 BR-SA-22b v3 — Merchant Health Score 5-tier distribution',
    description:
      '5 tiers per BR-SA-07: EXCELLENT (80-100) / GOOD (60-79) / AVERAGE (40-59) / WEAK (20-39) / AT_RISK_SCORE (0-19). ' +
      'Score = 0.4×recency + 0.3×frequency + 0.3×monetary (RFM). ' +
      'Cache `analytics:metric:merchant-comp-dist:<scope>:<periodKey>` TTL 15min/24h.',
  })
  @ApiResponse({
    status: 200,
    type: MerchantHealthDistributionTierDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Date range exceeds 366 days' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getMerchantHealthDistribution(@Query() query: AnalyticsQueryDto) {
    return this.merchantComparisonService.getHealthDistribution(query);
  }

  @Get('merchants/comparison')
  @ApiOperation({
    summary:
      'F-062 BR-SA-22c v3 — Full merchant comparison table (10 columns + totals footer)',
    description:
      'Columns: tenantId, tenantName, feeRate, races, orders, gmv, fee, manualPct, voidedPct, status, healthScore. ' +
      'Totals footer: orders, gmv, fee (sum across merchants). ' +
      'Phí 5BIB qua FeeService Tier 0 cascade. ' +
      'Cache `analytics:metric:merchant-comp-table:<scope>:<periodKey>` TTL 15min/24h.',
  })
  @ApiResponse({ status: 200, type: MerchantComparisonResponseDto })
  @ApiResponse({ status: 400, description: 'Date range exceeds 366 days' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not admin)' })
  getMerchantComparisonTable(@Query() query: AnalyticsQueryDto) {
    return this.merchantComparisonService.getComparisonTable(query);
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
