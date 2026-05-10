import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * F-023 — Dashboard response DTOs.
 *
 * Gộp toàn bộ 7 endpoint vào 1 file để tránh nhiễu folder + giúp Swagger
 * generate type cho admin SDK chạy `pnpm generate:api` thuận tiện.
 */

// ─────────────────────────────────────────────────────────────────────
// 1) GET /admin/dashboard/kpi
// ─────────────────────────────────────────────────────────────────────

export class KpiCardDto {
  @ApiProperty({ description: 'Khoá KPI: gmv | net | athletes | platform_fee' })
  key: string;

  @ApiProperty({ description: 'Nhãn hiển thị tiếng Việt' })
  label: string;

  @ApiProperty({ description: 'Giá trị MTD hiện tại (VND hoặc count)' })
  value: number;

  @ApiProperty({ description: 'Giá trị period trước (prev MTD)' })
  prevValue: number;

  @ApiPropertyOptional({
    description:
      'Phần trăm chênh lệch so với prev MTD. NULL khi không tính được (chia 0 / cùng 0). UI render "—".',
    type: Number,
    nullable: true,
  })
  deltaPercent: number | null;

  @ApiProperty({ description: "Đơn vị: 'vnd' | 'count'" })
  unit: 'vnd' | 'count';
}

export class KpiResponseDto {
  @ApiProperty({ type: [KpiCardDto] })
  kpis: KpiCardDto[];

  @ApiProperty({ description: "Period đã apply: 'mtd'" })
  period: string;

  @ApiProperty({ description: 'ISO date của ngày bắt đầu period hiện tại' })
  periodStart: string;

  @ApiProperty({ description: 'ISO date của ngày bắt đầu period trước' })
  prevPeriodStart: string;
}

// ─────────────────────────────────────────────────────────────────────
// 2) GET /admin/dashboard/sparklines
// ─────────────────────────────────────────────────────────────────────

export class SparklinePointDto {
  @ApiProperty({ description: 'Ngày YYYY-MM-DD' }) date: string;
  @ApiProperty({ description: 'Giá trị daily aggregate' }) value: number;
}

export class SparklineSeriesDto {
  @ApiProperty({ description: 'Khoá metric: gmv | net | athletes | platform_fee' })
  key: string;

  @ApiProperty({ type: [SparklinePointDto] })
  points: SparklinePointDto[];
}

export class SparklinesResponseDto {
  @ApiProperty({ type: [SparklineSeriesDto] })
  series: SparklineSeriesDto[];

  @ApiProperty({ description: 'Số ngày được tổng hợp (mặc định 30)' })
  days: number;

  @ApiProperty({ description: 'Thời điểm cron tổng hợp gần nhất (ISO)' })
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// 3) GET /admin/dashboard/live-races
// ─────────────────────────────────────────────────────────────────────

export class LiveRaceCardDto {
  @ApiProperty() raceId: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() slug?: string;
  @ApiPropertyOptional() province?: string;
  @ApiPropertyOptional() activeCourseName?: string;
  @ApiProperty({ description: '% checkpoint trung bình đã qua (0-100)' })
  progressPercent: number;
  @ApiProperty({ description: 'VĐV đang trên course (started - finished)' })
  runnersOnCourse: number;
  @ApiProperty({ description: 'Số alert critical đang mở' })
  alertsCount: number;
  @ApiProperty({
    description:
      'Border đỏ + dot pulse nhanh khi có alert critical (timing offline / mass DNF / medical sev 4-5)',
  })
  hasCriticalAlert: boolean;
}

export class LiveRacesResponseDto {
  @ApiProperty({ type: [LiveRaceCardDto] }) races: LiveRaceCardDto[];
}

// ─────────────────────────────────────────────────────────────────────
// 4) GET /admin/dashboard/upcoming-races
// ─────────────────────────────────────────────────────────────────────

export class UpcomingRaceCardDto {
  @ApiProperty() raceId: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() slug?: string;
  @ApiPropertyOptional() province?: string;
  @ApiPropertyOptional({ description: 'Ngày bắt đầu (ISO)' })
  startDate?: string;
  @ApiPropertyOptional({ description: 'Số ngày còn lại tới startDate' })
  daysRemaining?: number;
  @ApiProperty({ description: 'Số VĐV đăng ký' }) athleteCount: number;
  @ApiPropertyOptional({
    description:
      'Readiness % (0-100). NULL khi race chưa cấu hình readiness checklist.',
    type: Number,
    nullable: true,
  })
  readinessPercent: number | null;
}

export class UpcomingRacesResponseDto {
  @ApiProperty({ type: [UpcomingRaceCardDto] }) races: UpcomingRaceCardDto[];
}

// ─────────────────────────────────────────────────────────────────────
// 5) GET /admin/dashboard/pending-tasks
// ─────────────────────────────────────────────────────────────────────

export class PendingTaskGroupDto {
  @ApiProperty({ description: 'Khoá nhóm: claims | recon | master_data | chip' })
  key: string;
  @ApiProperty({ description: 'Nhãn tiếng Việt' }) label: string;
  @ApiProperty({ description: 'Số task' }) count: number;
  @ApiProperty({ description: 'Đường dẫn admin để xử lý' }) href: string;
}

export class PendingTasksResponseDto {
  @ApiProperty({ type: [PendingTaskGroupDto] })
  groups: PendingTaskGroupDto[];

  @ApiProperty({ description: 'Tổng count tất cả nhóm' })
  total: number;
}

// ─────────────────────────────────────────────────────────────────────
// 6) GET /admin/dashboard/recent-activity
// ─────────────────────────────────────────────────────────────────────

export class RecentActivityActorDto {
  @ApiProperty() userId: string;
  @ApiPropertyOptional() displayName?: string;
  @ApiPropertyOptional() role?: string;
}

export class RecentActivityEntityDto {
  @ApiProperty() type: string;
  @ApiProperty() id: string;
  @ApiPropertyOptional() displayName?: string;
}

export class RecentActivityItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: RecentActivityActorDto }) actor: RecentActivityActorDto;
  @ApiProperty() action: string;
  @ApiProperty({ type: RecentActivityEntityDto }) entity: RecentActivityEntityDto;
  @ApiPropertyOptional({
    description: 'Metadata phụ thuộc action',
    type: Object,
  })
  metadata?: Record<string, unknown>;
  @ApiProperty({ description: 'ISO timestamp' }) createdAt: string;
}

export class RecentActivityResponseDto {
  @ApiProperty({ type: [RecentActivityItemDto] })
  items: RecentActivityItemDto[];
}

// ─────────────────────────────────────────────────────────────────────
// 7) GET /admin/dashboard/system-status
// ─────────────────────────────────────────────────────────────────────

export class SystemServiceStatusDto {
  @ApiProperty({ description: 'Khoá service: api | mylaps | email | storage' })
  key: string;
  @ApiProperty({ description: 'Nhãn hiển thị' }) label: string;
  @ApiProperty({ description: "'ok' | 'degraded' | 'down'" })
  status: 'ok' | 'degraded' | 'down';
  @ApiPropertyOptional({ description: 'Thông điệp chi tiết (KHÔNG leak credential)' })
  message?: string;
  @ApiPropertyOptional({
    description:
      'ISO timestamp của lần check OK gần nhất (giúp UI tính "down từ X phút")',
  })
  lastOkAt?: string;
}

export class SystemStatusResponseDto {
  @ApiProperty({ type: [SystemServiceStatusDto] })
  services: SystemServiceStatusDto[];

  @ApiProperty({
    description:
      'TRUE khi API hoặc MyLaps đỏ liên tục > 5 phút (dùng để show banner đỏ trên cùng dashboard, BR-DASH-20).',
  })
  systemDown: boolean;

  @ApiProperty({ description: 'ISO timestamp của lần response này' })
  checkedAt: string;
}
