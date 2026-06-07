import { ApiProperty } from '@nestjs/swagger';

export class RevenueTrendPointDto {
  @ApiProperty({ description: 'Bucket key (YYYY-MM-DD / YYYY-Www / YYYY-MM)', example: '2026-03-01' })
  bucket: string;

  @ApiProperty({ description: 'VN display label', example: '01/03' })
  label: string;

  @ApiProperty({ description: 'GMV bucket = Σ(price−discount) VND', example: 50000000 })
  gmv: number;

  @ApiProperty({ description: 'Phí 5BIB bucket VND', example: 2750000 })
  totalFee: number;

  @ApiProperty({ description: 'Net = GMV − phí VND', example: 47250000 })
  net: number;

  @ApiProperty({ description: 'Số đơn paid bucket', example: 120 })
  orderCount: number;
}

export class RevenueTrendDto {
  @ApiProperty({ example: 138 })
  raceId: number;

  @ApiProperty({ enum: ['7d', '30d', '90d', 'quarter', 'year'], example: '30d' })
  period: string;

  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'], example: 'daily' })
  granularity: string;

  @ApiProperty({ type: [RevenueTrendPointDto] })
  series: RevenueTrendPointDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings: string[];
}
