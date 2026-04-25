import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LogtoAdminGuard } from '../logto-auth';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(LogtoAdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
