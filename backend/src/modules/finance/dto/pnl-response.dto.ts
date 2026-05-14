import { ApiProperty } from '@nestjs/swagger';
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

export class PnLSummaryDto {
  @ApiProperty()
  contractId!: string;

  @ApiProperty({ description: 'Revenue VND (include VAT — BR-PNL-02)' })
  revenue!: number;

  @ApiProperty({ enum: ['ESTIMATED', 'ACTUAL'] })
  revenueSource!: 'ESTIMATED' | 'ACTUAL';

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
