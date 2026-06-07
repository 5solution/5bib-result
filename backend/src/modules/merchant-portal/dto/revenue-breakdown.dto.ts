import { ApiProperty } from '@nestjs/swagger';

/**
 * F-069 M2b-3b — Revenue breakdown + cross-tenant aggregate DTOs (FINANCE-GATED).
 *
 * BR-MP-12 (Danny chốt Option A 2026-06-05): gom `order_category` thành 2 nhóm
 * theo loại phí:
 *   - `fee_percent` = ORDINARY/GROUP_BUY/GROUP_BUY_FIXED/PERSONAL_GROUP/
 *                     CHANGE_COURSE/INSURANCE/null (treat % default)
 *   - `fee_fixed`   = MANUAL (VNĐ/vé)
 * Display Convention: backend trả RAW `groupKey` — frontend map qua
 * `merchant-labels.ts` ORDER_CATEGORY_GROUP ("Phí %" / "Phí cố định").
 *
 * BR-MP-21b cross-tenant: per-tenant FeeService loop (FeeService chỉ nhận 1
 * tenantId) — KHÔNG single multi-tenant query (mỗi tenant config fee riêng).
 */

/** One fee-type group in the revenue category breakdown. */
export class RevenueCategoryGroupDto {
  @ApiProperty({
    description: 'Raw group key — frontend maps VN label',
    enum: ['fee_percent', 'fee_fixed'],
    example: 'fee_percent',
  })
  groupKey!: 'fee_percent' | 'fee_fixed';

  @ApiProperty({ description: 'GMV nhóm = Σ(price−discount) VND', example: 950000000 })
  gmv!: number;

  @ApiProperty({ description: 'Phí 5BIB nhóm VND', example: 52250000 })
  totalFee!: number;

  @ApiProperty({ description: 'Net nhóm = GMV − phí VND', example: 897750000 })
  net!: number;

  @ApiProperty({ description: 'Số đơn paid trong nhóm', example: 2800 })
  orderCount!: number;
}

/** GET /revenue/by-category — single race, 2-group Option A (BR-MP-12). */
export class RevenueByCategoryDto {
  @ApiProperty({ description: 'MySQL race_id', example: 138 })
  raceId!: number;

  @ApiProperty({ description: 'Tổng GMV (= Σ group.gmv)', example: 1035025000 })
  gmv!: number;

  @ApiProperty({
    description: 'Luôn 2 nhóm fee_percent + fee_fixed (0 nếu vắng)',
    type: [RevenueCategoryGroupDto],
  })
  groups!: RevenueCategoryGroupDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings!: string[];
}

/** One tenant row in the cross-tenant aggregate. */
export class RevenueTenantRowDto {
  @ApiProperty({ description: 'MySQL tenant_id (BTC)', example: 46 })
  tenantId!: number;

  @ApiProperty({ description: 'GMV BTC VND', example: 1035025000 })
  gmv!: number;

  @ApiProperty({ description: 'Phí 5BIB BTC VND', example: 56926375 })
  totalFee!: number;

  @ApiProperty({ description: 'Net BTC = GMV − phí VND', example: 978098625 })
  net!: number;

  @ApiProperty({ description: 'Số đơn paid', example: 3031 })
  orderCount!: number;
}

/** GET /revenue/aggregate — cross-tenant "Tất cả BTC" (BR-MP-21b). */
export class RevenueAggregateDto {
  @ApiProperty({ description: 'Tổng GMV mọi BTC VND', example: 2070050000 })
  gmv!: number;

  @ApiProperty({ description: 'Tổng phí mọi BTC VND', example: 113852750 })
  totalFee!: number;

  @ApiProperty({ description: 'Tổng net = GMV − phí VND', example: 1956197250 })
  net!: number;

  @ApiProperty({ description: 'Tổng đơn paid mọi BTC', example: 6062 })
  orderCount!: number;

  @ApiProperty({
    description: 'Per-tenant breakdown (scoped to accessible races, sorted gmv DESC)',
    type: [RevenueTenantRowDto],
  })
  byTenant!: RevenueTenantRowDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings!: string[];
}
