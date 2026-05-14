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

  @ApiProperty({ description: 'Tổng chi phí VND (BR-PNL-05)' })
  totalCost!: number;

  /**
   * FEATURE-033 — Source attribution của totalCost (UI hiển thị badge "Ước tính"
   * vs "Thực tế" + tooltip giải thích).
   *   - 'actual'    → cost_items có data, totalCost = sum cost_items.amount
   *   - 'estimated' → cost_items rỗng, totalCost = sum(line_items[i].cost × quantity)
   *   - 'none'      → cả 2 = 0 (HĐ cũ pre-F-033 chưa nhập cost gì)
   */
  @ApiProperty({
    enum: ['actual', 'estimated', 'none'],
    description: 'Source attribution của totalCost (F-033)',
  })
  totalCostSource!: 'actual' | 'estimated' | 'none';

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
