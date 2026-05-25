import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-2 NEW DTO — Lead Time histogram bucket (BR-SA-20b v3).
 *
 * 5 fixed buckets per PRD spec line 481-484:
 *   0-7d / 8-30d / 31-60d / 61-120d / 120+d
 * UI insight: design hiển thị summary text "X% nhóm lớn nhất, Y% last-minute".
 */
export class RunnerLeadTimeBucketDto {
  @ApiProperty({
    description: 'Bucket key',
    enum: ['0-7d', '8-30d', '31-60d', '61-120d', '120+d'],
    example: '8-30d',
  })
  bucket!: '0-7d' | '8-30d' | '31-60d' | '61-120d' | '120+d';

  @ApiProperty({
    description: 'VN label cho UI',
    example: 'Cận race',
  })
  label!: string;

  @ApiProperty({ description: 'Số orders trong bucket', example: 1245 })
  count!: number;

  @ApiProperty({
    description: '% tổng orders (rounded 2 decimals)',
    example: 28.5,
  })
  percentage!: number;

  @ApiProperty({
    description: 'Tailwind color class per design palette',
    example: 'amber-400',
  })
  color!: string;
}
