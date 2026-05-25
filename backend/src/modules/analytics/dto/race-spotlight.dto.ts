import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-1 NEW DTO — Race Spotlight response (BR-SA-21b v3).
 *
 * Single race với GMV cao nhất trong period. UI hiển thị highlighted card với
 * insight text auto-generated: "Đóng góp X% tổng GMV, trung bình Y VND/đơn".
 *
 * Nullable response: nếu period không có race nào paid order → service returns
 * `null` (controller wraps in 200 với null body, UI hiển thị empty state).
 */
export class RaceSpotlightDto {
  @ApiProperty({ description: 'Race ID (MySQL races.race_id)', example: 1042 })
  raceId!: number;

  @ApiProperty({
    description: 'Race title',
    example: 'VnExpress Marathon 2026',
  })
  raceName!: string;

  @ApiProperty({
    description: 'Merchant name (tenant.name)',
    example: 'Sun Sports Vietnam',
  })
  merchant!: string;

  @ApiProperty({
    description: 'Race type machine key',
    enum: [
      'ROAD_MARATHON',
      'ROAD_HALF_MARATHON',
      'ULTRA_TRAIL_RACE',
      'TRAIL_RACE',
      'OTHER',
    ],
    example: 'ROAD_MARATHON',
  })
  type!:
    | 'ROAD_MARATHON'
    | 'ROAD_HALF_MARATHON'
    | 'ULTRA_TRAIL_RACE'
    | 'TRAIL_RACE'
    | 'OTHER';

  @ApiProperty({
    description: 'Race date ISO YYYY-MM-DD (latest paid order date as proxy)',
    example: '2026-04-15',
    nullable: true,
  })
  date!: string | null;

  @ApiProperty({ description: 'GMV paid (exclude MANUAL)', example: 1500000000 })
  gmv!: number;

  @ApiProperty({ description: 'Số đơn paid (exclude MANUAL)', example: 2845 })
  orders!: number;

  @ApiProperty({
    description: 'Average GMV per order (gmv / orders)',
    example: 527241,
  })
  avgPerOrder!: number;

  @ApiProperty({
    description: 'Platform fee via FeeService.computeFeeForOrdersAggregate()',
    example: 105000000,
  })
  platformFee!: number;

  @ApiProperty({
    description:
      'Auto-generated insight text in VN: "Đóng góp X% tổng GMV, trung bình Y VND/đơn"',
    example: 'Đóng góp 12.5% tổng GMV, trung bình 527.241 đ/đơn',
  })
  insight!: string;
}
