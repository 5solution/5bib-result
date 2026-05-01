import { ApiProperty } from '@nestjs/swagger';

export class RaceAthleteStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  withBib!: number;

  @ApiProperty({ type: Object, additionalProperties: { type: 'number' } })
  byCourse!: Record<string, number>;

  @ApiProperty({ type: Object, additionalProperties: { type: 'number' } })
  byStatus!: Record<string, number>;

  @ApiProperty({ type: Date, nullable: true })
  lastSyncedAt!: Date | null;
}
