import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import {
  COMPOUNDING_MODES,
  CompoundingMode,
  GENDERS,
  Gender,
  PODIUM_GENDERS,
  PODIUM_STATES,
  PODIUM_TYPES,
  PodiumGender,
  PodiumState,
  PodiumType,
} from '../schemas/podium.schema';
import { PodiumStateTransitionResponseDto } from './podium-state-update.dto';

export class PodiumAthleteResponseDto {
  @ApiProperty() bib: string;
  @ApiProperty() name: string;
  @ApiProperty() rank: number;
  @ApiPropertyOptional() chipTimeMs?: number;
  @ApiPropertyOptional() chipTime?: string;
  @ApiPropertyOptional() gunTimeMs?: number;
  @ApiPropertyOptional() gender?: string;
  /** PII boundary (PAUSE-CODER-12) — chỉ trả age computed, KHÔNG trả raw DOB. */
  @ApiPropertyOptional() ageOnRaceDay?: number;
  @ApiPropertyOptional() nationality?: string;
  @ApiPropertyOptional() athleteId?: string;
  @ApiPropertyOptional() tied?: boolean;
}

export class PodiumResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() raceId: string;
  @ApiProperty() courseId: string;
  @ApiProperty() courseName: string;
  @ApiPropertyOptional() courseDistanceKm?: number;
  @ApiProperty() ageGroup: string;
  @ApiProperty() ageGroupKey: string;
  @ApiProperty() ageGroupLabel: string;
  /** F-020 — `'mixed'` cho OVERALL podium, `'M'`/`'F'` cho AG bucket. */
  @ApiProperty({ enum: PODIUM_GENDERS }) gender: PodiumGender;
  @ApiProperty() presetKey: string;
  @ApiProperty({ enum: COMPOUNDING_MODES })
  compoundingMode: CompoundingMode;
  @ApiProperty() agTopN: number;
  /** F-020 BR-AG-43 — discriminator AG vs OVERALL podium. */
  @ApiProperty({ enum: PODIUM_TYPES, default: 'AG' })
  podiumType: PodiumType;
  @ApiProperty({ type: [PodiumAthleteResponseDto] })
  athletes: PodiumAthleteResponseDto[];
  @ApiProperty({ enum: PODIUM_STATES }) state: PodiumState;
  @ApiProperty({ type: [PodiumStateTransitionResponseDto] })
  stateHistory: PodiumStateTransitionResponseDto[];
  @ApiPropertyOptional() computedAt?: string;
  @ApiPropertyOptional() lockedAt?: string;
  @ApiPropertyOptional() publishedAt?: string;
  @ApiPropertyOptional() disputedAt?: string;
  @ApiPropertyOptional() finalAt?: string;
  @ApiPropertyOptional() latestPdfS3Key?: string;
  @ApiPropertyOptional() latestPdfGeneratedAt?: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class PodiumListResponseDto {
  @ApiProperty({ type: [PodiumResponseDto] })
  items: PodiumResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty({
    description:
      'Distribution by state (banner counts): { RAW_RESULT: 5, PODIUM_LOCKED: 3, ... }',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  countsByState: Record<string, number>;
}

export class ListPodiumFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsEnum(GENDERS)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ageGroup?: string;

  @ApiPropertyOptional({ enum: PODIUM_STATES })
  @IsOptional()
  @IsEnum(PODIUM_STATES)
  state?: PodiumState;

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

export class RecomputeRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional limit recompute to specific course; nếu không truyền thì recompute toàn race.',
  })
  @IsOptional()
  @IsString()
  courseId?: string;
}

export class RecomputeResponseDto {
  @ApiProperty() raceId: string;
  @ApiProperty() podiumsCreatedOrUpdated: number;
  @ApiProperty() warningsCreated: number;
  @ApiProperty() durationMs: number;
  @ApiProperty({
    enum: ['5bib', 'vendor', 'hybrid'],
    description: 'F-019 v2 — bracketSource used in this recompute (race-level override or default 5bib)',
    required: false,
  })
  bracketSource?: '5bib' | 'vendor' | 'hybrid';
}
