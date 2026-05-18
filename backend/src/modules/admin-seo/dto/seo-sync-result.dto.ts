import { ApiProperty } from '@nestjs/swagger';

export class SeoSyncResultDto {
  @ApiProperty({ description: 'Số race quét trong run này' })
  racesScanned!: number;

  @ApiProperty({ description: 'Số slug mới generate trong run này' })
  slugsGenerated!: number;

  @ApiProperty({
    type: [String],
    description: 'Các path đã gọi revalidate tới frontend',
  })
  revalidatedPaths!: string[];

  @ApiProperty({
    type: [String],
    description: 'Errors trong quá trình sync (nếu có)',
  })
  errors!: string[];

  @ApiProperty({ description: 'Thời gian chạy (ms)' })
  durationMs!: number;

  @ApiProperty({
    description: 'true nếu lock bị skip (concurrent run khác đang chạy)',
  })
  lockSkipped!: boolean;
}

export class SeoSyncLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty({ required: false })
  finishedAt?: Date;

  @ApiProperty({ enum: ['cron', 'manual'] })
  triggeredBy!: 'cron' | 'manual';

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty()
  racesScanned!: number;

  @ApiProperty()
  slugsGenerated!: number;

  @ApiProperty({ type: [String] })
  revalidatedPaths!: string[];

  @ApiProperty({ type: [String] })
  errors!: string[];

  @ApiProperty()
  durationMs!: number;

  @ApiProperty()
  lockSkipped!: boolean;
}
