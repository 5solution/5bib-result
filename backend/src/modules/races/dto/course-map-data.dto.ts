import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GpxBoundsDto, GpxParsedDto } from './gpx-parsed.dto';

/**
 * Public-facing checkpoint shape returned in `CourseMapDataDto.checkpoints`.
 * Includes auto-matched OR manually-positioned lat/lng (BR-CM-04/05).
 */
export class CheckpointWithPositionDto {
  @ApiProperty({ description: 'Timing point key (e.g. "TM1", "Finish")', example: 'TM1' })
  key!: string;

  @ApiProperty({ description: 'Display name (e.g. "Trạm 1 - Suối Vàng")', example: 'Trạm 1 - Suối Vàng' })
  name!: string;

  @ApiPropertyOptional({ description: 'Distance label (display string)', example: '5K' })
  distance?: string;

  @ApiPropertyOptional({ description: 'Numeric km for pace projection', example: 5.2 })
  distanceKm?: number;

  @ApiPropertyOptional({ description: 'Latitude (WGS84) — null if not yet positioned' })
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude (WGS84) — null if not yet positioned' })
  lng?: number;

  @ApiPropertyOptional({
    description: 'Aid station services (water/food/medical/dropBag/sleep/notes).',
  })
  services?: Record<string, boolean | string | undefined>;
}

/**
 * Public response for `GET /api/races/:raceId/courses/:courseId/map-data`.
 *
 * `hasGpx=false` is returned when the race is in a public state (`pre_race | live | ended`)
 * but BTC has not uploaded a GPX yet (Concern 1) — frontend renders an empty-state notice
 * instead of hiding the section.
 */
export class CourseMapDataDto {
  @ApiProperty({ description: 'True when the course has a parsed GPX/KML.' })
  hasGpx!: boolean;

  @ApiPropertyOptional({
    description: 'Public S3 URL for the simplified GeoJSON track (BR-CM-11). Absent when hasGpx=false.',
  })
  gpxSimplifiedUrl?: string;

  @ApiPropertyOptional({
    type: GpxParsedDto,
    description: 'Parsed metadata (BR-CM-02/03/06). Absent when hasGpx=false.',
  })
  gpxParsed?: GpxParsedDto;

  @ApiProperty({
    type: [CheckpointWithPositionDto],
    description:
      'Course checkpoints with positions when available. Returned even when hasGpx=false — UI may show distance pills without map markers.',
  })
  checkpoints!: CheckpointWithPositionDto[];

  @ApiPropertyOptional({
    type: GpxBoundsDto,
    description: 'Track bounding box (WGS84). Absent when hasGpx=false.',
  })
  bounds?: GpxBoundsDto;
}
