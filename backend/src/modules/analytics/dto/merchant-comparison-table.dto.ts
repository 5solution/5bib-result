import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2B-2 NEW DTO — Comparison table item (BR-SA-22c v3).
 *
 * 10 columns sortable trong UI:
 *   STT | Tên merchant | Fee rate | Số giải | Đơn hàng | GMV | Phí 5BIB |
 *   Thủ công % | Huỷ % | Health Score
 *
 * Phí 5BIB PHẢI dùng `FeeService.computeFeeForOrdersAggregate()` per BR-SA-22c
 * mandate — KHÔNG inline tính phí (matches Wave 2B-1 BR-SA-02 convention).
 */
export class MerchantComparisonItemDto {
  @ApiProperty({ description: 'Tenant ID', example: 42 })
  tenantId!: number;

  @ApiProperty({
    description: 'Tenant display name',
    example: 'CÔNG TY CỔ PHẦN THỂ THAO VIỆT NAM',
  })
  tenantName!: string;

  @ApiProperty({
    description: 'Default service_fee_rate (%) từ MerchantConfig',
    example: 5.5,
  })
  feeRate!: number;

  @ApiProperty({
    description: 'Số giải races đã tổ chức trong period',
    example: 4,
  })
  races!: number;

  @ApiProperty({
    description: 'Số đơn paid (exclude MANUAL) trong period',
    example: 2845,
  })
  orders!: number;

  @ApiProperty({
    description: 'GMV paid (exclude MANUAL) trong period',
    example: 1500000000,
  })
  gmv!: number;

  @ApiProperty({
    description:
      'Platform fee via FeeService.computeFeeForOrdersAggregate() — F-040 cascade',
    example: 105000000,
  })
  fee!: number;

  @ApiProperty({
    description: 'Tỷ lệ % đơn MANUAL / tổng đơn paid',
    example: 12.3,
  })
  manualPct!: number;

  @ApiProperty({
    description: 'Tỷ lệ % đơn voided / (paid + voided)',
    example: 4.5,
  })
  voidedPct!: number;

  @ApiProperty({
    description: 'Merchant status per BR-SA-07',
    enum: ['ACTIVE', 'AT_RISK', 'CHURNED', 'NEW'],
    example: 'ACTIVE',
  })
  status!: 'ACTIVE' | 'AT_RISK' | 'CHURNED' | 'NEW';

  @ApiProperty({
    description: 'Health Score 0-100 (RFM formula BR-SA-07)',
    example: 84,
  })
  healthScore!: number;
}

/**
 * F-062 Wave 2B-2 NEW DTO — Comparison table totals footer (BR-SA-22c v3).
 *
 * UI hiển thị footer row "Tổng" với 3 metrics aggregate across all merchants.
 * KHÔNG include healthScore avg (mean of scores meaningless across heterogeneous merchants).
 */
export class MerchantComparisonTotalsDto {
  @ApiProperty({
    description: 'Sum orders across all merchants',
    example: 42850,
  })
  orders!: number;

  @ApiProperty({
    description: 'Sum GMV across all merchants',
    example: 23500000000,
  })
  gmv!: number;

  @ApiProperty({
    description: 'Sum platform fee across all merchants',
    example: 1645000000,
  })
  fee!: number;
}

/**
 * F-062 Wave 2B-2 NEW response wrapper — table data + totals (BR-SA-22c v3).
 */
export class MerchantComparisonResponseDto {
  @ApiProperty({
    type: MerchantComparisonItemDto,
    isArray: true,
    description: 'Per-merchant rows (default sort GMV DESC, UI overrides)',
  })
  data!: MerchantComparisonItemDto[];

  @ApiProperty({
    type: MerchantComparisonTotalsDto,
    description: 'Footer aggregate row',
  })
  totals!: MerchantComparisonTotalsDto;
}
