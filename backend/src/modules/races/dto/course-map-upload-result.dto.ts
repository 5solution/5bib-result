import { ApiProperty } from '@nestjs/swagger';
import { GpxParsedDto } from './gpx-parsed.dto';

/**
 * One waypoint that was matched against a course checkpoint key (BR-CM-04).
 * `matchType` distinguishes Level-1 (`exact`) from Level-2 (`case-insensitive`)
 * so admin UI can surface a warning toast for case-insensitive auto-assignments.
 */
export class WaypointMatchDto {
  @ApiProperty({ description: 'Checkpoint key the waypoint was matched to (e.g. "TM1")' })
  key!: string;

  @ApiProperty({ description: 'Latitude assigned to the checkpoint (WGS84)' })
  lat!: number;

  @ApiProperty({ description: 'Longitude assigned to the checkpoint (WGS84)' })
  lng!: number;

  @ApiProperty({
    description: 'Match level — exact (case-sensitive) or case-insensitive normalisation',
    enum: ['exact', 'case-insensitive'],
  })
  matchType!: 'exact' | 'case-insensitive';
}

/**
 * Response of `POST /admin/races/:raceId/courses/:courseId/gpx`.
 *
 * `unmatchedCheckpointKeys` is the set of `course.checkpoints[].key` that did NOT match
 * any waypoint name in the uploaded GPX/KML (Level-3 no-match per BR-CM-04). These need
 * manual drag (BR-CM-05).
 */
export class CourseMapUploadResultDto {
  @ApiProperty({ type: GpxParsedDto, description: 'Parsed GPX metadata (BR-CM-02/03/06)' })
  gpxParsed!: GpxParsedDto;

  @ApiProperty({ description: 'Public S3 URL for the simplified GeoJSON track' })
  gpxSimplifiedUrl!: string;

  @ApiProperty({
    type: [WaypointMatchDto],
    description: 'Checkpoints whose lat/lng were auto-assigned from a matching waypoint.',
  })
  autoMatchedCheckpoints!: WaypointMatchDto[];

  @ApiProperty({
    type: [String],
    description:
      'Checkpoint keys that did NOT match any waypoint — admin must drag manually (BR-CM-05).',
  })
  unmatchedCheckpointKeys!: string[];
}
