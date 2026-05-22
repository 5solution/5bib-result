import { ApiProperty } from '@nestjs/swagger';

/**
 * F-058 BR-58-01 — DTO cho `FeeService.computeFeeForOrdersAggregate()`.
 *
 * Input: 1 tenantId + N orders (đã pull từ MySQL bởi Analytics) + period window.
 * Output: aggregate fee đã cascade Tier 0/1/2/3 + per-order pro-rate theo
 * order.created_at (PAUSE-58-07 = A) vs override.effective_from.
 *
 * KHÔNG tạo OrderForFee DTO class — interface đủ vì pure internal, KHÔNG expose
 * qua HTTP boundary.
 */

/**
 * Input order shape — Analytics service pull từ MySQL platform DB.
 * Coder MUST đảm bảo SELECT trả về đúng 6 field này (camelCase OR snake_case
 * đều OK — FeeService normalize).
 */
export interface OrderForFeeAggregate {
  /** MySQL `order_metadata.id` */
  id: number;
  /** MySQL `order_metadata.race_id` */
  raceId: number;
  /** VND, MySQL `order_metadata.total_price` */
  totalPrice: number;
  /** VND, MySQL `order_metadata.total_discounts` (nullable → coerce 0) */
  totalDiscounts: number;
  /** ORDINARY / PERSONAL_GROUP / MANUAL / etc. */
  orderCategory: string;
  /** PAUSE-58-07 = A — field decisive cho effective_from check */
  createdAt: Date | string;
  /** Chỉ áp dụng cho MANUAL — total ticket count qua order_line_item join */
  manualTicketCount?: number;
}

export class FeeSourceBreakdownEntryDto {
  @ApiProperty({ enum: ['event_override', 'merchant_default', 'contract_fallback', 'platform_default'] })
  source!: 'event_override' | 'merchant_default' | 'contract_fallback' | 'platform_default';

  @ApiProperty({ description: 'Tổng fee VND aggregate qua source này' })
  totalFee!: number;

  @ApiProperty({ description: 'Số order phân loại theo source này' })
  orderCount!: number;
}

export class AppliedOverrideEntryDto {
  @ApiProperty({ description: 'MySQL race_id' })
  raceId!: number;

  @ApiProperty({ description: 'Field nào của override được apply', enum: ['service_fee_rate', 'manual_fee_per_ticket', 'fee_vat_rate'] })
  field!: 'service_fee_rate' | 'manual_fee_per_ticket' | 'fee_vat_rate';

  @ApiProperty({ description: 'Giá trị override (rate %, manual VND, vat %)' })
  value!: number;

  @ApiProperty({ description: 'ISO YYYY-MM-DD' })
  effectiveFrom!: string;
}

export class AnalyticsFeeAggregateResultDto {
  @ApiProperty()
  tenantId!: number;

  @ApiProperty({ description: 'Tổng phí dịch vụ VND đã round (chưa cộng VAT)' })
  totalServiceFee!: number;

  @ApiProperty({ description: 'Tổng phí MANUAL VND' })
  totalManualFee!: number;

  @ApiProperty({ description: 'Tổng VAT trên fee VND' })
  totalVat!: number;

  @ApiProperty({ description: 'Tổng phí = serviceFee + manualFee + vat' })
  totalFee!: number;

  @ApiProperty({ description: 'Tổng net GMV qua các orders đã tính (5BIB-eligible only)' })
  totalNetGmv!: number;

  @ApiProperty({ type: [FeeSourceBreakdownEntryDto], description: 'Aggregate per source — debug/audit' })
  feeSourceBreakdown!: FeeSourceBreakdownEntryDto[];

  @ApiProperty({ type: [AppliedOverrideEntryDto], description: 'Override đã apply (per race per field)' })
  appliedOverrides!: AppliedOverrideEntryDto[];

  @ApiProperty({ type: [String], description: 'Log fallback Tier 3, missing config v.v.' })
  warnings!: string[];
}
