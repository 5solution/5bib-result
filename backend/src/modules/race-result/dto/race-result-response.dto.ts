import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/dto/pagination.dto';

export class RaceResultItemDto {
  @ApiProperty({ example: '1193' }) Bib: string;
  @ApiProperty({ example: 'Hoàng Lộc Phước' }) Name: string;
  @ApiProperty({ example: '1' }) OverallRank: string;
  @ApiProperty({ example: '1' }) GenderRank: string;
  @ApiProperty({ example: '1' }) CatRank: string;
  @ApiProperty({ example: 'Male' }) Gender: string;
  @ApiProperty({ example: 'Male Under 30' }) Category: string;
  @ApiProperty({ example: '1:04:34' }) ChipTime: string;
  @ApiProperty({ example: '1:04:34' }) GunTime: string;
  @ApiProperty({ example: 'Finish' }) TimingPoint: string;
  @ApiProperty({ example: '6:27' }) Pace: string;
  @ApiPropertyOptional({ example: 'Verified' }) Certi: string;
  @ApiPropertyOptional({ example: 'https://example.com/cert.pdf' }) Certificate: string;
  @ApiPropertyOptional() OverallRanks: string;
  @ApiPropertyOptional() GenderRanks: string;
  @ApiPropertyOptional() Chiptimes: string;
  @ApiPropertyOptional() Guntimes: string;
  @ApiPropertyOptional() Paces: string;
  @ApiPropertyOptional() TODs: string;
  @ApiPropertyOptional() Sectors: string;
  @ApiPropertyOptional() OverrankLive: string;
  @ApiPropertyOptional({ example: '--' }) Gap: string;
  @ApiPropertyOptional({ example: 'VN' }) Nationality: string;
  @ApiPropertyOptional({ example: 'VNM' }) Nation: string;
  @ApiPropertyOptional() Member: string;
  @ApiPropertyOptional({ example: 384 }) Started: number;
  @ApiPropertyOptional({ example: 348 }) Finished: number;
  @ApiPropertyOptional({ example: 46 }) DNF: number;
  @ApiProperty({ example: '6651abc123' }) race_id: string;
  @ApiProperty({ example: '708' }) course_id: string;
  @ApiProperty({ example: '10KM' }) distance: string;
  @ApiPropertyOptional() synced_at: string;
}

export class RaceResultsPaginatedDto {
  @ApiProperty({ type: [RaceResultItemDto] }) data: RaceResultItemDto[];
  @ApiProperty({ type: PaginationMeta }) pagination: PaginationMeta;
}

export class RaceDistanceItemDto {
  @ApiProperty({ example: '6651abc123' }) raceId: string;
  @ApiProperty({ example: '10KM' }) distance: string;
  @ApiProperty({ example: '708' }) courseId: string;
  @ApiProperty({ example: 'Cao Bang Ultra Trail 2025' }) raceTitle: string;
}

export class AthleteDetailResponseDto {
  @ApiProperty({ type: RaceResultItemDto, nullable: true }) data: RaceResultItemDto | null;
  @ApiProperty({ example: true }) success: boolean;
  @ApiPropertyOptional({ example: 'Athlete not found' }) message?: string;
}

export class CompareAthletesResponseDto {
  @ApiProperty({ type: [RaceResultItemDto] }) data: RaceResultItemDto[];
  @ApiProperty({ example: true }) success: boolean;
}

export class FilterOptionsDto {
  @ApiProperty({ type: [String], example: ['Male', 'Female'] }) genders: string[];
  @ApiProperty({ type: [String], example: ['Male Under 30', 'Female 30-39'] }) categories: string[];
}

export class FilterOptionsResponseDto {
  @ApiProperty({ type: FilterOptionsDto }) data: FilterOptionsDto;
  @ApiProperty({ example: true }) success: boolean;
}

export class CourseStatsDto {
  @ApiProperty({ example: 150 }) totalFinishers: number;
  @ApiPropertyOptional({ example: '02:30:00' }) avgTime: string | null;
  @ApiPropertyOptional({ example: '01:04:34' }) minTime: string | null;
  @ApiPropertyOptional({ example: '05:59:59' }) maxTime: string | null;
  @ApiPropertyOptional() avgPace: string | null;
  @ApiProperty({ example: 80 }) maleCount: number;
  @ApiProperty({ example: 70 }) femaleCount: number;
}

export class CourseStatsResponseDto {
  @ApiProperty({ type: CourseStatsDto }) data: CourseStatsDto;
  @ApiProperty({ example: true }) success: boolean;
}

export class GlobalSearchResultDto extends RaceResultItemDto {
  @ApiProperty({ example: 'Cao Bang Ultra Trail 2025' }) race_name: string;
  @ApiProperty({ example: 'cao-bang-2025' }) race_slug: string;
  @ApiPropertyOptional() race_date: string;
}

export class GlobalSearchResponseDto {
  @ApiProperty({ type: [GlobalSearchResultDto] }) data: GlobalSearchResultDto[];
}

export class ClaimUploadResponseDto {
  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/file.gpx' }) url: string;
}

export class ClaimSubmitResponseDto {
  @ApiProperty() data: object;
  @ApiProperty({ example: true }) success: boolean;
}

export class SyncResponseDto {
  @ApiProperty({ example: 'Sync completed successfully' }) message: string;
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) timestamp: string;
}
