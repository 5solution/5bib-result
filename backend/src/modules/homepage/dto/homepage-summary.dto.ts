import { ApiProperty } from '@nestjs/swagger';

/**
 * Single race card for homepage listings.
 *
 * SECURITY: This DTO intentionally OMITS internal fields such as
 * `_id`, `productId`, `externalRaceId`, `rawData`, `cacheTtlSeconds`,
 * `statusHistory`, `apiUrl`, `apiFormat`. Those must never be leaked
 * to public clients (PRD §Testing Mandates — Security Checks).
 */
export class RaceCardDto {
  @ApiProperty({ example: 'cao-bang-ultra-trail-2025' }) slug: string;
  @ApiProperty({ example: 'Cao Bang Ultra Trail 2025' }) name: string;
  @ApiProperty({ example: 'https://cdn.5bib.com/covers/cao-bang.jpg' })
  coverImageUrl: string;
  @ApiProperty({ enum: ['live', 'upcoming', 'ended'], example: 'live' })
  status: 'live' | 'upcoming' | 'ended';
  @ApiProperty({
    example: '2025-11-15T00:00:00.000Z',
    description: 'ISO date string (from Race.startDate)',
  })
  eventDate: string;
  @ApiProperty({ type: [String], example: ['5K', '10K', '21K', '42K'] })
  courses: string[];
  @ApiProperty({
    example: 1234,
    description: '0 if race has not ended yet',
  })
  totalFinishers: number;
}

export class PaginatedRaceDto {
  @ApiProperty({ type: [RaceCardDto] }) items: RaceCardDto[];
  @ApiProperty({ example: 48 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 9 }) limit: number;
}

export class HomepageSummaryDto {
  @ApiProperty({ example: 195 }) totalRaces: number;
  @ApiProperty({ example: 94000 }) totalAthletes: number;
  @ApiProperty({ example: 82341 }) totalResults: number;
  @ApiProperty({ type: [RaceCardDto] }) liveRaces: RaceCardDto[];
  @ApiProperty({ type: [RaceCardDto] }) upcomingRaces: RaceCardDto[];
  @ApiProperty({ type: PaginatedRaceDto }) endedRaces: PaginatedRaceDto;
}

export class HomepageSummaryResponseDto {
  @ApiProperty({ type: HomepageSummaryDto }) data: HomepageSummaryDto;
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({
    example: 'HIT',
    enum: ['HIT', 'MISS'],
    description: 'Redis cache status for this request',
  })
  cache: 'HIT' | 'MISS';
}

export class EndedRacesResponseDto {
  @ApiProperty({ type: PaginatedRaceDto }) data: PaginatedRaceDto;
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'HIT', enum: ['HIT', 'MISS'] })
  cache: 'HIT' | 'MISS';
}
