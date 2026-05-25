import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-2 NEW DTO — Booking Heatmap response (BR-SA-20a v3).
 *
 * 7 hàng (dow 0=CN .. 6=T7) × 24 cột (0h-23h) matrix of order counts.
 * Timezone: MySQL DAYOFWEEK/HOUR functions apply server local TZ.
 */
export class RunnerBookingHeatmapResponseDto {
  @ApiProperty({
    description: '7×24 matrix [dow 0-6 (0=Sun)][hour 0-23] of order counts',
    example: [[12, 8, 5, '...']],
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  matrix!: number[][];
}
