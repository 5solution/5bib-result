import { ApiProperty } from '@nestjs/swagger';

/**
 * F-015 BR-CK-08/09 — Check-In stats response shapes.
 */

export class StationCounterDto {
  @ApiProperty() stationId: string;
  @ApiProperty() count: number;
  @ApiProperty({ required: false, nullable: true })
  lastActivityAt?: string | null;
}

export class RecentEventDto {
  @ApiProperty() bib: string;
  @ApiProperty({ required: false, nullable: true }) name?: string | null;
  @ApiProperty() stationId: string;
  @ApiProperty() checkedInAt: string;
}

export class CheckInStatsDataDto {
  @ApiProperty() totalAthletes: number;
  @ApiProperty() pickedUp: number;
  @ApiProperty({ type: [StationCounterDto] }) perStation: StationCounterDto[];
  @ApiProperty({ description: 'Aggregate pickup rate over the last 60s window.' })
  ratePerMinute: number;
  @ApiProperty({ type: [RecentEventDto] }) recentEvents: RecentEventDto[];
}

export class CheckInStatsResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty({ type: CheckInStatsDataDto, required: false })
  data?: CheckInStatsDataDto;
}

export class CheckInSseEventDto {
  @ApiProperty({ enum: ['pickup', 'heartbeat'] })
  type: 'pickup' | 'heartbeat';
  @ApiProperty({ required: false }) raceId?: string;
  @ApiProperty({ required: false }) bib?: string;
  @ApiProperty({ required: false }) athleteId?: number;
  @ApiProperty({ required: false }) stationId?: string;
  @ApiProperty({ required: false }) checkedInAt?: string;
}
