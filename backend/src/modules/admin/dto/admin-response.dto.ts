import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaAlt } from '../../../common/dto/pagination.dto';

export class SyncLogDto {
  @ApiProperty() _id: string;
  @ApiProperty() raceId: string;
  @ApiProperty() courseId: string;
  @ApiProperty({ enum: ['success', 'failed'] }) status: string;
  @ApiPropertyOptional() resultCount: number;
  @ApiProperty() durationMs: number;
  @ApiPropertyOptional() errorMessage: string;
  @ApiProperty() created_at: Date;
}

export class SyncLogsPaginatedDto {
  @ApiProperty({ type: [SyncLogDto] }) data: SyncLogDto[];
  @ApiProperty({ type: PaginationMetaAlt }) pagination: PaginationMetaAlt;
}

export class ClaimDto {
  @ApiProperty() _id: string;
  @ApiProperty() raceId: string;
  @ApiProperty() courseId: string;
  @ApiProperty() bib: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() phone: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: [String] }) attachments: string[];
  @ApiProperty({ enum: ['pending', 'resolved', 'rejected'] }) status: string;
  @ApiPropertyOptional() adminNote: string;
  @ApiProperty() created_at: Date;
}

export class ClaimsPaginatedDto {
  @ApiProperty({ type: [ClaimDto] }) data: ClaimDto[];
  @ApiProperty({ type: PaginationMetaAlt }) pagination: PaginationMetaAlt;
}

export class ForceSyncResponseDto {
  @ApiProperty({ example: 'Force sync completed' }) message: string;
  @ApiProperty({ example: 150 }) count: number;
  @ApiProperty({ example: true }) success: boolean;
}

export class ResetDataResponseDto {
  @ApiProperty({ example: 'Deleted 150 results' }) message: string;
  @ApiProperty({ example: 150 }) deletedCount: number;
}

export class PurgeCacheResponseDto {
  @ApiProperty({ example: 'Purged 5 cache keys' }) message: string;
  @ApiProperty({ example: 5 }) deleted: number;
}
