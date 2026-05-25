import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2B-2 NEW DTO — Scatter chart point (BR-SA-22a v3).
 *
 * 1 merchant = 1 bubble. UI plots x=orders, y=gmv, size=gmv proportional.
 * Status drives quadrant labeling (★ HIGH VALUE top-right, ⚠ LOW ACTIVITY bottom-left).
 */
export class MerchantScatterPointDto {
  @ApiProperty({
    description: 'Tenant ID (MySQL platform.tenant.id)',
    example: 42,
  })
  tenantId!: number;

  @ApiProperty({
    description: 'Tenant display name (MySQL platform.tenant.name)',
    example: 'CÔNG TY CỔ PHẦN THỂ THAO VIỆT NAM',
  })
  tenantName!: string;

  @ApiProperty({
    description: 'Số đơn paid trong period (exclude MANUAL)',
    example: 2845,
  })
  orders!: number;

  @ApiProperty({
    description: 'GMV paid trong period (exclude MANUAL)',
    example: 1500000000,
  })
  gmv!: number;

  @ApiProperty({
    description:
      'Merchant status per BR-SA-07: ACTIVE | AT_RISK | CHURNED | NEW',
    enum: ['ACTIVE', 'AT_RISK', 'CHURNED', 'NEW'],
    example: 'ACTIVE',
  })
  status!: 'ACTIVE' | 'AT_RISK' | 'CHURNED' | 'NEW';
}
