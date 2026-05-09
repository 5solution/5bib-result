import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

/**
 * Body of `PATCH /admin/races/:raceId/courses/:courseId/checkpoint-position`.
 * Used by admin Leaflet manual-drag mode (BR-CM-05) to persist a moved marker.
 *
 * Lat/lng are validated against WGS84 bounds (BR-CM-03) so invalid drag events
 * coming from a misbehaving client return 400 rather than corrupting the schema.
 */
export class UpdateCheckpointPositionDto {
  @ApiProperty({ description: 'Checkpoint key (must already exist in course.checkpoints[])', example: 'TM1' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Latitude (WGS84, [-90, 90])', example: 20.9612 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Longitude (WGS84, [-180, 180])', example: 105.8542 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}
