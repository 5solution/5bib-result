import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissingInvoiceRowDto, AlertSeverity } from './missing-invoice-row.dto';
import { MisaOrphanRowDto } from './misa-orphan-row.dto';

/**
 * F-076 PRD 3.3 — top-level response cho `GET /today` + `POST /trigger`.
 *
 * Cache key Redis `invoice-reconcile:last-run:<YYYY-MM-DD>` TTL 24h.
 * Reuse từ admin UI fast load (Server Component initial fetch).
 */
export type Layer2Status = 'OK' | 'DEGRADED' | 'UNAVAILABLE';

/**
 * F-088 — error breakdown snapshot cho dashboard (cùng công thức tin Telegram
 * F-086: total = unissued + duplicate + orphan + misaFail; breached ⊂ unissued).
 */
export class ErrorBreakdownDto {
  @ApiProperty({ description: 'Đơn UNISSUED (gồm breached)', example: 1 })
  unissued!: number;

  @ApiProperty({ description: 'Đơn DUPLICATE', example: 0 })
  duplicate!: number;

  @ApiProperty({ description: 'MISA orphan (MISA có, DB không match)', example: 1 })
  orphan!: number;

  @ApiProperty({ description: 'Lỗi gọi MISA hôm nay (hạ tầng)', example: 0 })
  misaFail!: number;

  @ApiProperty({ description: 'Tổng = unissued+duplicate+orphan+misaFail', example: 2 })
  total!: number;
}

export class ReconcileReportDto {
  @ApiProperty({
    description: 'Ngày báo cáo (yyyy-MM-dd ICT)',
    example: '2026-06-09',
  })
  date!: string;

  @ApiProperty({
    description: 'Thời điểm reconcile chạy (ISO 8601 UTC)',
    example: '2026-06-09T07:00:00.000Z',
  })
  runAt!: string;

  @ApiProperty({
    description: 'Mode chạy reconcile',
    enum: ['cron', 'manual', 'hourly-recap', 'eod-recap'],
    example: 'cron',
  })
  mode!: 'cron' | 'manual' | 'hourly-recap' | 'eod-recap';

  @ApiProperty({ description: 'Race IDs scanned', example: [140, 220] })
  raceIdsScanned!: number[];

  @ApiProperty({
    description: 'Tổng đơn paid cần xuất hóa đơn hôm nay (BR-01 filter)',
    example: 48,
  })
  expectedCount!: number;

  @ApiProperty({
    description: 'Đơn đã có vat_ref + MISA match (bucket OK)',
    example: 44,
  })
  issuedCount!: number;

  @ApiPropertyOptional({
    description:
      'F-079 BR-79-12 — Số đơn skip khỏi expected pool (INSURANCE/MANUAL category).' +
      ' = dbOrders.length - expectedCount. Default 0 nếu old cached report.',
    example: 2,
  })
  skippedCount?: number;

  @ApiProperty({
    description: 'Đơn UNISSUED + SYNC_LAG (cần action)',
    example: 4,
  })
  missingCount!: number;

  @ApiProperty({
    description: 'Đơn age > ageCriticalHours (sắp phạt)',
    example: 1,
  })
  atRiskCount!: number;

  @ApiProperty({ description: 'Đơn DUPLICATE bucket', example: 1 })
  duplicateCount!: number;

  @ApiProperty({
    description: 'Đơn age >= ageBreachedHours (đã phạt)',
    example: 0,
  })
  breachedCount!: number;

  @ApiProperty({
    description: 'Chi tiết missing rows (UNISSUED + SYNC_LAG + DUPLICATE)',
    type: [MissingInvoiceRowDto],
  })
  missing!: MissingInvoiceRowDto[];

  @ApiProperty({
    description: 'MISA orphan (MISA xuất nhưng DB không có orderId match)',
    type: [MisaOrphanRowDto],
  })
  misaOrphan!: MisaOrphanRowDto[];

  @ApiProperty({
    description: 'Trạng thái Layer 2 MISA call (BR-16)',
    enum: ['OK', 'DEGRADED', 'UNAVAILABLE'],
    example: 'OK',
  })
  layer2Status!: Layer2Status;

  @ApiProperty({
    description: 'Max severity bucket tick này',
    enum: ['INFO', 'WARN', 'CRITICAL'],
    example: 'CRITICAL',
  })
  maxSeverity!: AlertSeverity;

  @ApiProperty({
    description: 'Có gửi alert lần chạy này không (do dedup hoặc skip condition)',
    example: true,
  })
  alertSent!: boolean;

  // ───────────── F-088 dashboard enrichment (chỉ set khi serve /today) ─────────────

  @ApiPropertyOptional({
    description:
      'F-086/F-088 — Tổng hóa đơn đã xuất từ 08/06/2026 (MISA TotalCount). ' +
      'Đọc persisted, refresh throttled 5 phút khi serve /today.',
    example: 98,
  })
  cumulativeIssued?: number;

  @ApiPropertyOptional({
    description: 'F-088 — Error breakdown snapshot (cùng công thức tin Telegram).',
    type: ErrorBreakdownDto,
  })
  errorBreakdown?: ErrorBreakdownDto;

  @ApiPropertyOptional({
    description:
      'F-088 — Daily counters hôm nay (scan-ticks, misa-ok/fail, alert-*). ' +
      'Key→số. Rỗng nếu Redis fail.',
    example: { 'scan-ticks': 96, 'misa-ok': 95, 'misa-fail': 1, 'alert-warn': 0 },
  })
  dailyCounters?: Record<string, number>;
}
