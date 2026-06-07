import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * F-069 M2b-2b — Ticket Sales chart DTOs (BR-MP-07 Phase 1 charts).
 *
 * Trend + Stacked: time-bucket via F-062 `period-resolver` (PeriodKind) +
 * `resolveBucketSize` (GranularityKind sqlGroupExpr) + `bucket-helpers`.
 * Order table: paginated order_metadata + chain to course/type. BR-MP-09 STRICT
 * — NO financial (total_price/fee/gmv) AND NO raw email/phone (PII conservatism).
 * Display Convention: backend returns RAW status/courseId — frontend maps VN.
 */

const PERIOD_VALUES = ['7d', '30d', '90d', 'quarter', 'year'] as const;
const GRANULARITY_VALUES = ['daily', 'weekly', 'monthly'] as const;

/** Shared query for trend + stacked. */
export class TicketChartQueryDto {
  @ApiProperty({ description: 'MySQL race_id', example: 138 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId!: number;

  @ApiPropertyOptional({ enum: PERIOD_VALUES, default: '30d' })
  @IsIn([...PERIOD_VALUES], { message: 'period không hợp lệ' })
  @IsOptional()
  period?: (typeof PERIOD_VALUES)[number] = '30d';

  @ApiPropertyOptional({ enum: GRANULARITY_VALUES, default: 'daily' })
  @IsIn([...GRANULARITY_VALUES], { message: 'granularity không hợp lệ' })
  @IsOptional()
  granularity?: (typeof GRANULARITY_VALUES)[number] = 'daily';
}

/** One point in a trend series. */
export class TicketTrendPointDto {
  @ApiProperty({ description: 'Bucket key (YYYY-MM-DD / YYYY-Www / YYYY-MM)', example: '2026-03-01' })
  bucket!: string;

  @ApiProperty({ description: 'VN display label', example: '01/03' })
  label!: string;

  @ApiProperty({ description: 'Số đơn paid trong bucket', example: 42 })
  orderCount!: number;
}

/** GET /ticket-sales/trend — registration trend (BR-MP-07 chart #1). */
export class TicketTrendDto {
  @ApiProperty({ example: 138 })
  raceId!: number;

  @ApiProperty({ enum: PERIOD_VALUES, example: '30d' })
  period!: string;

  @ApiProperty({ enum: GRANULARITY_VALUES, example: 'daily' })
  granularity!: string;

  @ApiProperty({ type: [TicketTrendPointDto] })
  series!: TicketTrendPointDto[];
}

/** Course descriptor in the stacked chart (stable order across calls). */
export class StackedCourseDto {
  @ApiProperty({ example: 459 })
  courseId!: number;

  @ApiProperty({ example: '21KM' })
  courseName!: string;
}

/** One time bucket with per-course ticket counts. */
export class StackedSeriesPointDto {
  @ApiProperty({ description: 'Bucket key', example: '2026-03-01' })
  bucket!: string;

  @ApiProperty({ description: 'VN display label', example: '01/03' })
  label!: string;

  @ApiProperty({
    description: 'courseId → ticket count (SUM quantity paid). Missing course = 0.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '459': 120, '460': 80 },
  })
  counts!: Record<number, number>;
}

/** GET /ticket-sales/stacked — AnStacked course × time (BR-MP-07 chart #2). */
export class TicketStackedDto {
  @ApiProperty({ example: 138 })
  raceId!: number;

  @ApiProperty({ enum: PERIOD_VALUES, example: '30d' })
  period!: string;

  @ApiProperty({ enum: GRANULARITY_VALUES, example: 'daily' })
  granularity!: string;

  @ApiProperty({ type: [StackedCourseDto], description: 'Stable display order (total ticket DESC)' })
  courses!: StackedCourseDto[];

  @ApiProperty({ type: [StackedSeriesPointDto] })
  series!: StackedSeriesPointDto[];
}

/** Query for the paginated order detail table. */
export class TicketOrdersQueryDto {
  @ApiProperty({ description: 'MySQL race_id', example: 138 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId!: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Filter financial_status', enum: ['paid', 'voided', 'pending'] })
  @IsIn(['paid', 'voided', 'pending'])
  @IsOptional()
  financialStatus?: string;

  @ApiPropertyOptional({ description: 'Tìm theo tên người mua (LIKE first_name/last_name/name)', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}

/**
 * One row in the order detail table. NO financial (total_price/fee).
 * Buyer contact INCLUDED (Danny 2026-06-05: BTC là người tổ chức, sở hữu data
 * khách của race họ — show full email + phone for ops).
 */
export class TicketOrderRowDto {
  @ApiProperty({ description: 'MySQL order_metadata.id', example: 12358181 })
  orderId!: number;

  @ApiProperty({ description: 'Tên người mua (first_name + last_name hoặc name)', example: 'Nguyễn Văn A' })
  buyerName!: string;

  @ApiProperty({ description: 'Email người mua (BTC ops contact)', nullable: true, example: 'a@gmail.com' })
  buyerEmail!: string | null;

  @ApiProperty({ description: 'SĐT người mua (BTC ops contact)', nullable: true, example: '0901234567' })
  buyerPhone!: string | null;

  @ApiProperty({ description: 'Cự ly (rc.name)', nullable: true, example: '21KM' })
  courseName!: string | null;

  @ApiProperty({ description: 'Loại vé (tt.type_name)', nullable: true, example: 'Standard 21K' })
  ticketTypeName!: string | null;

  @ApiProperty({ description: 'Số vé (SUM oli.quantity)', example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Raw financial_status — frontend maps VN', example: 'paid' })
  financialStatus!: string;

  @ApiProperty({ description: 'Ngày thanh toán', nullable: true })
  paymentOn!: Date | null;
}

/** GET /ticket-sales/orders — paginated order detail table (BR-MP-07). */
export class TicketOrderListDto {
  @ApiProperty({ type: [TicketOrderRowDto] })
  items!: TicketOrderRowDto[];

  @ApiProperty({ example: 1234 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

// ────────────────────────────────────────────────────────────────
// F-070 — Advanced MKT analytics (forecast / heatmap / target).
// 3 chart đều ticket-scope (BR-70-01/02) — NO financial values.
// ────────────────────────────────────────────────────────────────

/** Shared query for forecast + heatmap (raceId required). */
export class TicketChartRaceQueryDto {
  @ApiProperty({ description: 'MySQL race_id', example: 138 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId!: number;
}

export class TicketForecastPointDto {
  @ApiProperty({ description: 'Ngày (YYYY-MM-DD)' }) date!: string;
  @ApiProperty({ description: 'Vé lũy kế tới hết ngày này' }) value!: number;
}
export class TicketForecastDto {
  @ApiProperty({ type: [TicketForecastPointDto] }) cumulative!: TicketForecastPointDto[];
  @ApiProperty({ description: 'Vé dự báo về ngày đua (null nếu race ended hoặc <8 điểm dữ liệu)', nullable: true })
  projectedValue!: number | null;
  @ApiProperty({ description: 'Ngày đua = races.event_start_date (ISO, null nếu thiếu)', nullable: true })
  projectionDate!: string | null;
  @ApiProperty({ description: 'Tốc độ vé/ngày 7 ngày gần nhất' }) recentDailyRate!: number;
  @ApiProperty({ description: 'Mục tiêu BTC nhập (null nếu chưa set)', nullable: true }) target!: number | null;
  @ApiProperty({ description: 'true nếu race COMPLETE/CANCEL hoặc đã qua ngày đua' }) raceEnded!: boolean;
}

export class TicketHeatmapDto {
  @ApiProperty({ description: 'Nhãn 7 dòng thứ trong tuần (Mon..Sun)', type: [String] }) dayLabels!: string[];
  @ApiProperty({ description: 'Nhãn 7 cột khung giờ (giờ VN)', type: [String] }) bucketLabels!: string[];
  @ApiProperty({ description: 'grid[dayIndex][bucketIndex] = số đơn paid', type: 'array', items: { type: 'array', items: { type: 'number' } } })
  grid!: number[][];
  @ApiProperty({ description: 'Giá trị cell lớn nhất (để FE scale màu)' }) max!: number;
}

export class SetTicketTargetDto {
  @ApiProperty({ description: 'MySQL race_id' }) @Type(() => Number) @IsInt() @Min(1) raceId!: number;
  @ApiProperty({ description: 'Mục tiêu vé (0 = xoá mục tiêu)' })
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000, { message: 'Mục tiêu phải là số nguyên 0–10.000.000' })
  target!: number;
}
export class TicketTargetDto {
  @ApiProperty() raceId!: number;
  @ApiProperty({ nullable: true }) target!: number | null;
}
