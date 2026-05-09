import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Max,
  Min,
} from 'class-validator';
import {
  ANOMALY_PATTERNS,
  AnomalyPattern,
  RESOLUTIONS,
  Resolution,
  TIERS,
  Tier,
} from '../schemas/anomaly-warning.schema';

export class WarningTransitionResponseDto {
  @ApiProperty() action: string;
  @ApiProperty() actorId: string;
  @ApiProperty() at: string;
  @ApiPropertyOptional() note?: string;
  @ApiPropertyOptional() evidenceUrl?: string;
  @ApiPropertyOptional() priorTier?: number;
  @ApiPropertyOptional() newTier?: number;
}

export class AnomalyWarningResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() raceId: string;
  @ApiProperty() courseId: string;
  @ApiProperty() bib: string;
  @ApiPropertyOptional() athleteId?: string;
  @ApiPropertyOptional() athleteName?: string;
  @ApiProperty({ enum: ANOMALY_PATTERNS }) pattern: AnomalyPattern;
  @ApiProperty({ enum: TIERS }) tier: Tier;
  @ApiProperty({ minimum: 0, maximum: 1 }) confidence: number;
  @ApiProperty({ type: 'object', additionalProperties: true })
  evidence: Record<string, unknown>;
  @ApiPropertyOptional() ackedBy?: string;
  @ApiPropertyOptional() ackedAt?: string;
  @ApiPropertyOptional() ackNote?: string;
  @ApiProperty({ enum: RESOLUTIONS }) resolution: Resolution;
  @ApiPropertyOptional() resolvedBy?: string;
  @ApiPropertyOptional() resolvedAt?: string;
  @ApiPropertyOptional() resolutionNote?: string;
  @ApiPropertyOptional() overrideTier?: number;
  @ApiProperty({ type: [WarningTransitionResponseDto] })
  transitionHistory: WarningTransitionResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class AnomalyWarningListResponseDto {
  @ApiProperty({ type: [AnomalyWarningResponseDto] })
  items: AnomalyWarningResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty({
    description:
      'Số lượng theo tier cho banner: { "1": x, "2": y, "3": z }',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  countsByTier: Record<string, number>;
  @ApiProperty({
    description: 'Số Mức 1 + Mức 2 đang pending — gate cho podium lock',
  })
  blockingCount: number;
}

export class ListAnomalyFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ enum: TIERS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  tier?: number;

  @ApiPropertyOptional({ enum: RESOLUTIONS })
  @IsOptional()
  @IsEnum(RESOLUTIONS)
  resolution?: Resolution;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AckWarningDto {
  @ApiProperty({ minLength: 5, description: 'Note bắt buộc khi ack Mức 2' })
  @IsString()
  @MinLength(5)
  note: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}

export class ResolveWarningDto {
  @ApiProperty({ enum: ['ignored', 'fixed', 'btc_override'] })
  @IsIn(['ignored', 'fixed', 'btc_override'])
  resolution: 'ignored' | 'fixed' | 'btc_override';

  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  note: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @ApiPropertyOptional({
    enum: TIERS,
    description: 'BR-AG-22 — BTC tier override (KHÔNG mutate confidence)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  overrideTier?: number;
}
