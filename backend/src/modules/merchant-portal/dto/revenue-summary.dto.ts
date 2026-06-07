import { ApiProperty } from '@nestjs/swagger';

export class RevenueSummaryDto {
  @ApiProperty({ description: 'MySQL race_id đã filter', example: 501 })
  raceId: number;

  @ApiProperty({
    description: 'GMV gross (paid) = Σ(total_price − discounts) VND',
    example: 152000000,
  })
  gmv: number;

  @ApiProperty({ description: 'Tổng phí dịch vụ VND (chưa VAT)', example: 8360000 })
  totalServiceFee: number;

  @ApiProperty({ description: 'Tổng phí MANUAL VND', example: 0 })
  totalManualFee: number;

  @ApiProperty({ description: 'VAT trên phí VND', example: 0 })
  totalVat: number;

  @ApiProperty({
    description: 'Tổng phí 5BIB = serviceFee + manualFee + vat',
    example: 8360000,
  })
  totalFee: number;

  @ApiProperty({
    description: 'Net về BTC = GMV − totalFee VND',
    example: 143640000,
  })
  net: number;

  @ApiProperty({ description: 'Số đơn paid đã tính', example: 1234 })
  orderCount: number;

  @ApiProperty({
    description:
      'Cảnh báo fee cascade (vd MerchantConfig missing → Tier 3 fallback 5.5%). Rỗng nếu config đầy đủ.',
    type: [String],
    example: [],
  })
  warnings: string[];
}
