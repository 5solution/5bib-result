import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-2 NEW DTO — Geographic Top Provinces (BR-SA-20e v3).
 *
 * Top 8 tỉnh thành theo số lượng unique runner.
 * Data source: users.province (via order_metadata.user_id JOIN, best-effort
 * theo F-026 geographic-demographic.service.ts pattern).
 *
 * `coverage` = % runners có province / total runners.
 * `unknown_province` runners KHÔNG vào top 8 (separately tracked via coverage gap).
 */
export class RunnerGeographicProvinceDto {
  @ApiProperty({ description: 'Tên tỉnh thành', example: 'Hà Nội' })
  province!: string;

  @ApiProperty({ description: 'Số runner trong tỉnh', example: 1845 })
  count!: number;

  @ApiProperty({
    description: '% của totalWithProvince (rounded 2 decimals)',
    example: 18.5,
  })
  percentage!: number;
}

export class RunnerGeographicResponseDto {
  @ApiProperty({ type: RunnerGeographicProvinceDto, isArray: true })
  provinces!: RunnerGeographicProvinceDto[];

  @ApiProperty({
    description: 'Coverage % = totalWithProvince / totalRunners * 100',
    example: 72.5,
  })
  coverage!: number;

  @ApiProperty({
    description: 'Runners có province field populated',
    example: 7350,
  })
  totalWithProvince!: number;

  @ApiProperty({
    description: 'Total unique runners (distinct user_id paid orders)',
    example: 10145,
  })
  totalRunners!: number;
}
