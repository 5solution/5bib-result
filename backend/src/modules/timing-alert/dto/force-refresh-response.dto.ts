import { ApiProperty } from '@nestjs/swagger';

/**
 * F-005 BR-CC-10 — Force Refresh response shape.
 *
 * `status` mirrors raw `CommandCenterService.forceRefresh()` return:
 * - `TRIGGERED`: poll vendor RR API đã được trigger fresh + cache invalidated
 * - `STAMPEDE_WAIT`: race lock held bởi poller khác → caller dùng cached snapshot
 *
 * `refreshed`/`message` là UX-friendly aliases để frontend không phải decode
 * status enum.
 */
export class ForceRefreshResponseDto {
  @ApiProperty({
    description:
      'Raw service status — TRIGGERED nghĩa là đã refresh, STAMPEDE_WAIT nghĩa là caller phải dùng cached snapshot',
    enum: ['TRIGGERED', 'STAMPEDE_WAIT'],
  })
  status!: 'TRIGGERED' | 'STAMPEDE_WAIT';

  @ApiProperty({
    description: 'true nếu fresh poll đã trigger; false nếu stampede-wait',
  })
  refreshed!: boolean;

  @ApiProperty({
    description: 'Human-readable Vietnamese message cho toast UI',
  })
  message!: string;
}
