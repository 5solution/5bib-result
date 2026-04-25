import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseCheckpointDto {
  @ApiProperty({ example: 'TM1' }) key: string;
  @ApiProperty({ example: 'Trạm 1 - Suối Vàng' }) name: string;
  @ApiPropertyOptional({ example: '5K' }) distance?: string;
}

export class RaceCourseDto {
  @ApiProperty({ example: '708' }) courseId: string;
  @ApiProperty({ example: '10KM' }) name: string;
  @ApiPropertyOptional({ example: '10KM' }) distance?: string;
  @ApiPropertyOptional({ example: 10 }) distanceKm?: number;
  @ApiPropertyOptional({ enum: ['split', 'lap', 'team_relay', 'point_to_point'] }) courseType?: string;
  @ApiPropertyOptional() apiUrl?: string;
  @ApiPropertyOptional() apiFormat?: string;
  @ApiPropertyOptional() imageUrl?: string;
  @ApiPropertyOptional({ example: 500 }) elevationGain?: number;
  @ApiPropertyOptional({ example: '2026-03-07T06:00' }) startTime?: string;
  @ApiPropertyOptional({ example: 'Quảng trường Lâm Viên' }) startLocation?: string;
  @ApiPropertyOptional({ example: '2026-03-07T13:00' }) cutOffTime?: string;
  @ApiPropertyOptional() mapUrl?: string;
  @ApiPropertyOptional() gpxUrl?: string;
  @ApiProperty({ type: [CourseCheckpointDto] }) checkpoints: CourseCheckpointDto[];
}

export class RaceDto {
  @ApiProperty({ example: '6651abc123' }) _id: string;
  @ApiPropertyOptional() productId: string;
  @ApiProperty({ example: 'Cao Bang Ultra Trail 2025' }) title: string;
  @ApiPropertyOptional({ example: 'cao-bang-2025' }) slug: string;
  @ApiProperty({ example: 'live', enum: ['draft', 'pre_race', 'live', 'ended'] }) status: string;
  @ApiPropertyOptional() season: string;
  @ApiPropertyOptional() province: string;
  @ApiPropertyOptional() raceType: string;
  @ApiPropertyOptional() description: string;
  @ApiPropertyOptional() imageUrl: string;
  @ApiPropertyOptional() logoUrl: string;
  @ApiPropertyOptional() bannerUrl: string;
  @ApiPropertyOptional({ type: [String] }) sponsorBanners: string[];
  @ApiPropertyOptional() brandColor: string;
  @ApiPropertyOptional() startDate: Date;
  @ApiPropertyOptional() endDate: Date;
  @ApiPropertyOptional() location: string;
  @ApiPropertyOptional() organizer: string;
  @ApiProperty({ example: false }) enableEcert: boolean;
  @ApiProperty({ example: false }) enableClaim: boolean;
  @ApiProperty({ example: false }) enableLiveTracking: boolean;
  @ApiProperty({ example: false }) enable5pix: boolean;
  @ApiPropertyOptional() pixEventUrl: string;
  @ApiPropertyOptional({ example: 60 }) cacheTtlSeconds: number;
  @ApiProperty({ example: false }) enableHideStats: boolean;
  @ApiProperty({ example: false }) enablePrivateList: boolean;
  @ApiPropertyOptional({ example: 20 }) privateListLimit: number;
  @ApiProperty({ type: [RaceCourseDto] }) courses: RaceCourseDto[];
  @ApiPropertyOptional() externalRaceId: string;
}

export class RaceListPaginatedDto {
  @ApiProperty({
    type: 'object',
    properties: {
      totalPages: { type: 'number', example: 5 },
      currentPage: { type: 'number', example: 0 },
      totalItems: { type: 'number', example: 42 },
      list: { type: 'array', items: { $ref: '#/components/schemas/RaceDto' } },
    },
  })
  data: { totalPages: number; currentPage: number; totalItems: number; list: RaceDto[] };
  @ApiProperty({ example: true }) success: boolean;
}

export class RaceDetailResponseDto {
  @ApiProperty({ type: RaceDto }) data: RaceDto;
}

export class RaceSyncResponseDto {
  @ApiProperty({ example: 'Successfully synced 10 races' }) message: string;
  @ApiProperty({ example: 10 }) count: number;
  @ApiProperty({ example: true }) success: boolean;
}
