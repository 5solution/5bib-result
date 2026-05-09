import { ApiProperty } from '@nestjs/swagger';

/**
 * FEATURE-005 — Summary Cards row cho Command Center.
 *
 * 5 metric cards: Racekit / Started / Finished / DNS / Miss%
 *
 * Note: `racekitPickedUp` requires race-master-data + chip-verifications
 * cross-reference (mysql_race_id mapping). MVP F-005 chưa wire — return 0.
 * TD: integrate khi race.mysql_race_id field available hoặc khi
 * RaceAthleteLookupService inject vào TimingAlertModule.
 */
export class SummaryCardsDto {
  @ApiProperty({ description: 'Tổng athletes registered (proxy: race_results count)' })
  totalRegistered!: number;

  @ApiProperty({
    description:
      'Số racekit đã được pickup tại Bàn 2 (chip-verifications FOUND/ALREADY_PICKED_UP). 0 nếu chưa wire mysql_race_id mapping.',
  })
  racekitPickedUp!: number;

  @ApiProperty({ description: 'Athletes có Start time' })
  started!: number;

  @ApiProperty({ description: 'Athletes có Finish time' })
  finished!: number;

  @ApiProperty({ description: 'Did Not Start = totalRegistered - started' })
  dns!: number;

  @ApiProperty({ description: 'Số alerts OPEN (miss timing)' })
  missCount!: number;

  @ApiProperty({
    description:
      'Miss rate % = missCount / max(started, 1) * 100. Range 0..100.',
  })
  missRate!: number;
}
