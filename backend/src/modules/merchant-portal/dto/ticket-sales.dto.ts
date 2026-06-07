import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

/**
 * F-069 M2b-2 — Ticket Sales report DTOs (BR-MP-07/08/09).
 *
 * Schema source: `01-ba-prd-revision-r3.md` + live DB verify 2026-06-05.
 *   - Counts via chain `order_line_item oli → order_metadata om → ticket_type tt
 *     → race_course rc` (om has NO race_course_id — DISC-1).
 *   - `financial_status` ∈ {paid, voided, pending} (R3 FINAL BR-MP-08).
 *   - `tt.type_name` (DISC-4, NOT `name`), `rc.name` distance label (DISC-5).
 *
 * BR-MP-09 STRICT — NO financial fields (total_price/unit_price/GMV/fee/Net).
 * Only COUNT(order) + SUM(quantity). Display Convention: backend returns RAW
 * `financialStatus` enum — frontend maps qua `merchant-labels.ts` (M4).
 */

/** Per-status counts in the summary KPI (raw enum — frontend maps VN label). */
export class TicketStatusCountDto {
  @ApiProperty({
    description:
      'Raw financial_status (paid/voided/pending) — frontend maps qua ORDER_FINANCIAL_STATUS dict',
    example: 'paid',
  })
  financialStatus!: string;

  @ApiProperty({ description: 'Số đơn (COUNT DISTINCT order)', example: 1234 })
  orderCount!: number;

  @ApiProperty({ description: 'Số vé (SUM line item quantity)', example: 1890 })
  ticketCount!: number;
}

/** GET /ticket-sales/summary — 4 KPI cards (BR-MP-07). */
export class TicketSalesSummaryDto {
  @ApiProperty({ description: 'MySQL race_id đã filter', example: 501 })
  raceId!: number;

  @ApiProperty({
    description: 'Tổng vé tất cả trạng thái (SUM quantity all status)',
    example: 2456,
  })
  totalTickets!: number;

  @ApiProperty({
    description: 'Tổng đơn tất cả trạng thái',
    example: 1789,
  })
  totalOrders!: number;

  @ApiProperty({
    description:
      'Breakdown theo financial_status. LUÔN gồm paid/voided/pending (0 nếu vắng) — frontend render 3 KPI cards. Status lạ (nếu có) append cuối.',
    type: [TicketStatusCountDto],
  })
  byStatus!: TicketStatusCountDto[];
}

/** One row in a breakdown (course OR ticket type). */
export class TicketBreakdownItemDto {
  @ApiProperty({ description: 'ID (courseId hoặc ticketTypeId)', example: 459 })
  id!: number;

  @ApiProperty({
    description: 'Tên hiển thị (rc.name distance label hoặc tt.type_name)',
    example: '21KM',
  })
  name!: string;

  @ApiProperty({ description: 'Số đơn paid (COUNT DISTINCT order)', example: 1023 })
  orderCount!: number;

  @ApiProperty({ description: 'Số vé paid (SUM quantity)', example: 1466 })
  ticketCount!: number;
}

/** GET /ticket-sales/by-course OR /by-type — breakdown bar/donut data (BR-MP-07). */
export class TicketSalesBreakdownDto {
  @ApiProperty({ description: 'MySQL race_id đã filter', example: 501 })
  raceId!: number;

  @ApiProperty({
    description: 'Tổng vé paid (base để frontend tính %)',
    example: 1466,
  })
  totalTickets!: number;

  @ApiProperty({
    description: 'Items sorted ticketCount DESC',
    type: [TicketBreakdownItemDto],
  })
  items!: TicketBreakdownItemDto[];
}

/** Shared query DTO — raceId required for all ticket-sales endpoints. */
/** M2b-2b ticket-chart granularity union (re-exported for service typing). */
export type TicketChartGranularity = 'daily' | 'weekly' | 'monthly';

export class TicketSalesQueryDto {
  @ApiProperty({ description: 'MySQL race_id (bắt buộc)', example: 501 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId!: number;
}
