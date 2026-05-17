import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COST_CATEGORIES, CostCategory } from '../schemas/cost-item.schema';

/**
 * F-028 — response shapes cho cost items + P&L summary.
 *
 * Convention F-024 strip _id pitfall: response inject `id = _id.toString()`
 * trước khi remove `_id` để frontend KHÔNG mất identifier (CLAUDE.md
 * Pre-Deploy Checklist Field Nguy Hiểm).
 */
export class CostItemResponseDto {
  @ApiProperty({ example: '655a1234...', description: 'Hex ObjectId (alias _id)' })
  id!: string;

  @ApiProperty()
  contractId!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: COST_CATEGORIES })
  category!: CostCategory;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ required: false })
  note?: string;

  @ApiProperty({ required: false })
  incurredDate?: string;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty({ required: false })
  updatedBy?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

/**
 * FEATURE-040 — source attribution của fee 5BIB compute.
 *   - RECONCILIATION: full period covered by BBNT signed/equivalent recon docs
 *   - SELF_COMPUTE: no recon coverage → MySQL platform self-compute
 *   - MIXED: recon partial + self-compute fill gap
 *   - ESTIMATED: fallback (no tenant/race link OR cross-DB unreachable)
 */
export const FEE_SOURCES = [
  'RECONCILIATION',
  'SELF_COMPUTE',
  'MIXED',
  'ESTIMATED',
] as const;
export type FeeSource = (typeof FEE_SOURCES)[number];

/**
 * FEATURE-040 — slice của fee từ 1 recon doc (1 trong N recons cover period).
 */
export class ReconciledFeeSliceDto {
  @ApiProperty({ description: 'Recon doc _id (hex string)' })
  reconciliationId!: string;

  @ApiProperty({ description: 'Period start ISO YYYY-MM-DD' })
  periodStart!: string;

  @ApiProperty({ description: 'Period end ISO YYYY-MM-DD' })
  periodEnd!: string;

  @ApiProperty({ description: 'Recon status (signed/reviewed/completed/sent)' })
  status!: string;

  @ApiProperty({ description: 'Phí 5BIB orders từ recon (VND)' })
  feeAmount!: number;

  @ApiProperty({ description: 'Phí MANUAL orders từ recon (VND)' })
  manualFeeAmount!: number;

  @ApiPropertyOptional({
    description: 'TD-F016 legacy warning nếu created_at < 2026-05-08',
  })
  legacyWarning?: string;

  @ApiProperty({
    description: 'Signed/reviewed/completed timestamp ISO (nullable)',
    nullable: true,
  })
  finalizedAt!: string | null;
}

/**
 * FEATURE-040 — slice của fee từ self-compute MySQL platform pull.
 */
export class SelfComputeSliceDto {
  @ApiProperty({ description: 'Số đơn 5BIB-eligible (ORDINARY/GROUP_BUY/etc.)' })
  count5BIB!: number;

  @ApiProperty({ description: 'SUM(total_price) của 5BIB orders (VND)' })
  gross5BIB!: number;

  @ApiProperty({ description: 'Tỉ lệ phí % áp dụng' })
  feeRatePercent!: number;

  @ApiProperty({ description: 'Phí 5BIB = gross5BIB × feeRatePercent / 100 (VND)' })
  fee5BIB!: number;

  @ApiProperty({ description: 'Số đơn MANUAL' })
  countManual!: number;

  @ApiProperty({ description: 'Tổng số vé MANUAL (SUM line_item.quantity)' })
  manualTicketCount!: number;

  @ApiProperty({ description: 'VNĐ/vé MANUAL áp dụng' })
  manualFeePerTicket!: number;

  @ApiProperty({
    description: 'Phí MANUAL = manualTicketCount × manualFeePerTicket (VND)',
  })
  feeManual!: number;

  @ApiPropertyOptional({
    description: 'Period gap start that self-compute covers (when MIXED source)',
  })
  periodGapStart?: string;

  @ApiPropertyOptional({
    description: 'Period gap end that self-compute covers (when MIXED source)',
  })
  periodGapEnd?: string;

  @ApiPropertyOptional({
    description: 'Warning nếu fallback cascade tier 3 default 5.5% kích hoạt',
    example: 'MerchantConfig + contract.feePercentage cả 2 null - dùng default 5.5%',
  })
  rateFallbackWarning?: string;
}

/**
 * FEATURE-040 — full breakdown payload cho fee-breakdown drill-down endpoint.
 */
export class FeeBreakdownDto {
  @ApiProperty({ description: 'Contract ObjectId (hex string)' })
  contractId!: string;

  @ApiProperty({ enum: FEE_SOURCES })
  feeSource!: FeeSource;

  @ApiProperty({
    description: 'Total fee 5BIB = SUM(reconciliations) + selfCompute (VND)',
  })
  totalFee!: number;

  @ApiPropertyOptional({
    description: 'Gross GMV reference (KHÔNG dùng cho P&L, transparency only)',
  })
  grossGMV?: number;

  @ApiProperty({
    type: [ReconciledFeeSliceDto],
    description: 'Reconciliation slices contributing to total (empty if pure SELF_COMPUTE)',
  })
  reconciliations!: ReconciledFeeSliceDto[];

  @ApiPropertyOptional({
    type: SelfComputeSliceDto,
    description: 'Self-compute slice for period gap (omit if pure RECONCILIATION cover)',
  })
  selfCompute?: SelfComputeSliceDto;

  @ApiProperty({ description: 'Computed at ISO timestamp' })
  computedAt!: string;

  @ApiPropertyOptional({ description: 'Generic warnings if any', type: [String] })
  warnings?: string[];
}

export class PnLSummaryDto {
  @ApiProperty()
  contractId!: string;

  @ApiProperty({
    description: 'Revenue VND. F-040: TICKET_SALES → fee 5BIB thật (KHÔNG GMV). Non-TICKET_SALES → BBNT actualTotalWithVat hoặc totalAmount.',
  })
  revenue!: number;

  @ApiProperty({ enum: ['ESTIMATED', 'ACTUAL'] })
  revenueSource!: 'ESTIMATED' | 'ACTUAL';

  /**
   * FEATURE-040 — fee source attribution (TICKET_SALES only). Non-TICKET_SALES
   * contracts retain legacy `revenueSource` and feeSource undefined.
   */
  @ApiPropertyOptional({
    enum: FEE_SOURCES,
    description: 'F-040 fee source (TICKET_SALES only)',
  })
  feeSource?: FeeSource;

  /**
   * FEATURE-040 — gross GMV reference cho transparency (TICKET_SALES only).
   */
  @ApiPropertyOptional({
    description: 'F-040 gross GMV (SUM order.total_price) — TICKET_SALES only',
  })
  grossGMV?: number;

  /**
   * FEATURE-040 — fee compute warning (TD-F016 legacy / cross-DB degraded / etc.).
   */
  @ApiPropertyOptional({
    description: 'F-040 fee warning (TD legacy hoặc degraded path)',
  })
  feeWarning?: string;

  /**
   * FEATURE-040 — full breakdown (TICKET_SALES only).
   */
  @ApiPropertyOptional({
    type: FeeBreakdownDto,
    description: 'F-040 full fee breakdown (TICKET_SALES only)',
  })
  feeBreakdown?: FeeBreakdownDto;

  @ApiProperty({
    description:
      'Tổng chi phí VND = estimatedCost + actualCost (ADDITIVE, F-036)',
  })
  totalCost!: number;

  /**
   * FEATURE-036 — Breakdown ước tính từ line items (quote-time cost).
   * = sum(line_items[i].cost × quantity) cho mọi line item selected.
   */
  @ApiProperty({
    description: 'Chi phí ước tính từ line items (F-036)',
  })
  estimatedCost!: number;

  /**
   * FEATURE-036 — Breakdown thực tế phát sinh thêm.
   * = sum(cost_items.amount) — chi phí nhập tay sau khi sign HĐ.
   * KHÔNG override estimatedCost — ADD-ON.
   */
  @ApiProperty({
    description: 'Chi phí phát sinh thêm từ cost_items (F-036)',
  })
  actualCost!: number;

  /**
   * FEATURE-036 — Source attribution descriptive (NOT used in compute):
   *   - 'none'      → cả 2 = 0
   *   - 'estimated' → chỉ line_items có cost
   *   - 'actual'    → chỉ cost_items có data
   *   - 'mixed'     → cả 2 có data
   */
  @ApiProperty({
    enum: ['actual', 'estimated', 'mixed', 'none'],
    description: 'Source attribution descriptive (F-036)',
  })
  totalCostSource!: 'actual' | 'estimated' | 'mixed' | 'none';

  @ApiProperty({ description: 'Lãi/Lỗ VND (BR-PNL-06)' })
  profit!: number;

  @ApiProperty({
    nullable: true,
    description: 'Margin % rounded 1 decimal; null khi revenue=0 (BR-PNL-07)',
  })
  margin!: number | null;

  @ApiProperty({ enum: ['loss', 'thin', 'healthy', 'neutral'] })
  marginTier!: 'loss' | 'thin' | 'healthy' | 'neutral';

  @ApiProperty()
  costItemCount!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Tổng chi phí theo nhóm (donut chart Screen 3)',
    example: { LABOR: 5000000, MATERIAL: 12000000, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
  })
  costByCategory!: Record<string, number>;

  @ApiProperty({
    required: false,
    description:
      'Thông báo warning UI (vd contract chưa link tenant/race, MySQL down)',
  })
  warning?: string;
}

export class PaginatedCostItemsDto {
  @ApiProperty({ type: [CostItemResponseDto] })
  items!: CostItemResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
