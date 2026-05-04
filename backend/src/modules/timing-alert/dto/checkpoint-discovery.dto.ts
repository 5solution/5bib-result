import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Phase 2.1 — DTO cho `apply-checkpoints` endpoint.
 *
 * BTC nhận preview từ `discover` → có thể override `name` + `distanceKm`
 * → POST array này để save vào race document.
 */
export class CheckpointApplyItemDto {
  @ApiProperty({ description: 'Timing point key từ RR API (VD "Start", "TM1")' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Display name (BTC override được)', example: 'Trạm 1 - Suối Vàng' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Distance từ start tới checkpoint này (km). Null nếu BTC chưa nhập.',
    required: false,
    nullable: true,
    example: 5.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number | null;
}

export class ApplyCheckpointsDto {
  @ApiProperty({
    description: 'Danh sách checkpoint sau khi BTC review preview. Order trong array = order chronological của course.',
    type: [CheckpointApplyItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckpointApplyItemDto)
  checkpoints!: CheckpointApplyItemDto[];
}

// ─────────── Response DTOs ───────────

export class DetectedCheckpointDto {
  @ApiProperty() key!: string;
  @ApiProperty() suggestedName!: string;
  @ApiProperty({ nullable: true, type: Number }) suggestedDistanceKm!: number | null;
  @ApiProperty({ description: 'Fraction athletes có time non-empty (0..1)' })
  coverage!: number;
  @ApiProperty() medianTimeSeconds!: number;
  @ApiProperty() orderIndex!: number;
  @ApiProperty() passedCount!: number;
}

export class CheckpointDiscoveryResponseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ nullable: true, type: Number }) courseDistanceKm!: number | null;
  @ApiProperty() totalAthletes!: number;
  @ApiProperty() athletesWithAnyTime!: number;
  @ApiProperty() finishersCount!: number;
  @ApiProperty({ type: [DetectedCheckpointDto] })
  detectedCheckpoints!: DetectedCheckpointDto[];
  @ApiProperty({ type: [String], description: 'Explanation messages cho admin UI' })
  notes!: string[];
}

export class ApplyCheckpointsResponseDto {
  @ApiProperty() raceId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() saved!: number;
}
