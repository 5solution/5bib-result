import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';
import {
  KpiResponseDto,
  LiveRacesResponseDto,
  PendingTasksResponseDto,
  RecentActivityResponseDto,
  SparklinesResponseDto,
  SystemStatusResponseDto,
  UpcomingRacesResponseDto,
} from './dto/dashboard-response.dto';
import { DashboardKpiService } from './services/kpi.service';
import { DashboardLiveRacesService } from './services/live-races.service';
import { DashboardPendingTasksService } from './services/pending-tasks.service';
import { DashboardRecentActivityService } from './services/recent-activity.service';
import { DashboardSparklineService } from './services/sparkline.service';
import { DashboardSystemStatusService } from './services/system-status.service';
import { DashboardUpcomingRacesService } from './services/upcoming-races.service';

/**
 * F-023 — Admin Dashboard endpoints. 7 endpoint dưới prefix
 * `/api/admin/dashboard/*`. Tất cả gated bởi `LogtoAdminGuard`.
 */
@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    private readonly kpiService: DashboardKpiService,
    private readonly sparklineService: DashboardSparklineService,
    private readonly liveRacesService: DashboardLiveRacesService,
    private readonly upcomingRacesService: DashboardUpcomingRacesService,
    private readonly pendingTasksService: DashboardPendingTasksService,
    private readonly recentActivityService: DashboardRecentActivityService,
    private readonly systemStatusService: DashboardSystemStatusService,
  ) {}

  @Get('kpi')
  @ApiOperation({
    summary: 'KPI MTD vs prev MTD (4 cards: GMV / Net / VĐV / Phí 5BIB)',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Hiện chỉ hỗ trợ 'mtd' (mặc định)",
  })
  @ApiResponse({ status: 200, type: KpiResponseDto })
  async getKpi(): Promise<KpiResponseDto> {
    return this.kpiService.getMtdKpis();
  }

  @Get('sparklines')
  @ApiOperation({
    summary: 'Sparkline 30 ngày daily aggregate cho 4 KPI (cache 1h)',
  })
  @ApiResponse({ status: 200, type: SparklinesResponseDto })
  async getSparklines(): Promise<SparklinesResponseDto> {
    return this.sparklineService.getSparklines();
  }

  @Get('live-races')
  @ApiOperation({
    summary: 'Live races đang diễn ra + progress + alerts',
  })
  @ApiResponse({ status: 200, type: LiveRacesResponseDto })
  async getLiveRaces(): Promise<LiveRacesResponseDto> {
    return this.liveRacesService.getLiveRaces();
  }

  @Get('upcoming-races')
  @ApiOperation({
    summary: 'Upcoming races trong 30 ngày tới + readiness %',
  })
  @ApiResponse({ status: 200, type: UpcomingRacesResponseDto })
  async getUpcomingRaces(): Promise<UpcomingRacesResponseDto> {
    return this.upcomingRacesService.getUpcomingRaces();
  }

  @Get('pending-tasks')
  @ApiOperation({
    summary: 'Pending tasks 4 nhóm (claims/recon/master/chip), cache 60s',
  })
  @ApiResponse({ status: 200, type: PendingTasksResponseDto })
  async getPendingTasks(): Promise<PendingTasksResponseDto> {
    return this.pendingTasksService.getPendingTasks();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Recent activity timeline từ audit_logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: RecentActivityResponseDto })
  async getRecentActivity(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<RecentActivityResponseDto> {
    return this.recentActivityService.getRecentActivity(limit);
  }

  @Get('system-status')
  @ApiOperation({
    summary: 'System health 4 service (API/MyLaps/Email/Storage), cache 60s',
  })
  @ApiResponse({ status: 200, type: SystemStatusResponseDto })
  async getSystemStatus(): Promise<SystemStatusResponseDto> {
    return this.systemStatusService.getSystemStatus();
  }
}
