import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-1 NEW DTO — Race type distribution chart point (BR-SA-21a v3).
 *
 * 1 bar = 1 race type. UI horizontal bar chart GMV by race type.
 * Race types per existing MySQL `races.race_type` column values:
 *   - ROAD_MARATHON / ROAD_HALF_MARATHON
 *   - ULTRA_TRAIL_RACE / TRAIL_RACE
 *
 * Unknown / NULL race types grouped under `OTHER` (defensive fallback).
 */
export class RaceTypeDistributionPointDto {
  @ApiProperty({
    description: 'Race type machine key from races.race_type column',
    enum: [
      'ROAD_MARATHON',
      'ROAD_HALF_MARATHON',
      'ULTRA_TRAIL_RACE',
      'TRAIL_RACE',
      'OTHER',
    ],
    example: 'ROAD_MARATHON',
  })
  raceType!:
    | 'ROAD_MARATHON'
    | 'ROAD_HALF_MARATHON'
    | 'ULTRA_TRAIL_RACE'
    | 'TRAIL_RACE'
    | 'OTHER';

  @ApiProperty({
    description: 'Số race trong period thuộc type này',
    example: 12,
  })
  count!: number;

  @ApiProperty({
    description: 'Tổng GMV của tất cả races thuộc type này',
    example: 5500000000,
  })
  gmv!: number;

  @ApiProperty({
    description: 'Trung bình GMV per race trong type (gmv / count)',
    example: 458333333,
  })
  avgGmv!: number;
}
