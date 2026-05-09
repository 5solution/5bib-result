import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictedRankItemDto {
  @ApiProperty() athleteId: string;
  @ApiProperty() bib: string;
  @ApiPropertyOptional() name?: string;
  @ApiProperty() courseId: string;
  @ApiProperty() ageGroup: string;
  @ApiProperty() gender: string;
  @ApiProperty({ description: 'Predicted final rank trong AG' })
  predictedRank: number;
  @ApiProperty() estimatedFinishSec: number;
  @ApiProperty({ description: 'Tổng quãng đường từ lastSplit (km)' })
  remainingKm: number;
  @ApiProperty({ description: 'Distance lastSplit (km)' })
  lastSplitDistanceKm: number;
  @ApiProperty({ description: 'Sai số ước lượng theo loại race (phút)' })
  errorMarginMin: number;
  @ApiProperty() pattern: string; // 'A'
  @ApiProperty() confidence: number;
}

export class PredictedRankListResponseDto {
  @ApiProperty({ type: [PredictedRankItemDto] })
  items: PredictedRankItemDto[];
  @ApiProperty() total: number;
}
