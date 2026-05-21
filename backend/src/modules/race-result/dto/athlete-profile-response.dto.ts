/**
 * FEATURE-047 — Athlete Profile public response DTO.
 *
 * PII strip per BR-47-21..24: exclude email/phone/cccd/dob/address/paymentId.
 * Public fields allowed: name/bib/chipTime/gender/category(AG)/province/nationality/club + PR records + history.
 *
 * FEATURE-050 extend (2026-05-21): race-ops aware fields — additive optional only,
 * backward-compatible with F-047 consumers. Frontend gracefully hides when undefined.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AthletePRRecordDto {
  @ApiProperty({ enum: ['5K', '10K', 'HM', 'FM'] })
  distance!: '5K' | '10K' | 'HM' | 'FM';

  @ApiProperty() chipTime!: string;
  @ApiProperty() raceId!: string;
  @ApiProperty() raceSlug!: string;
  @ApiProperty() raceTitle!: string;
  @ApiPropertyOptional() raceDate?: string;
}

export class AthleteDistanceSpecialistDto {
  @ApiProperty({ description: 'Display distance label (e.g. "42K", "21K", "50K")' })
  distance!: string;

  @ApiProperty({ description: 'Number of finished races at this distance' })
  count!: number;
}

export class AthleteBestAgRankDto {
  @ApiProperty() raceId!: string;
  @ApiProperty() raceSlug!: string;
  @ApiProperty() raceTitle!: string;
  @ApiPropertyOptional() raceDate?: string;
  @ApiProperty({ description: 'AG rank position (numeric string)' })
  rank!: string;
  @ApiPropertyOptional({ description: 'AG bracket label (e.g. "Nữ 30-39")' })
  bracket?: string;
}

export class AthleteRaceHistoryRowDto {
  @ApiProperty() raceId!: string;
  @ApiProperty() raceSlug!: string;
  @ApiProperty() raceTitle!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiPropertyOptional() distance?: string;
  @ApiProperty() chipTime!: string;
  @ApiProperty() bib!: string;
  @ApiPropertyOptional() overallRank?: string;
  @ApiPropertyOptional() categoryRank?: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() raceDate?: string;
  @ApiProperty({ enum: ['finished', 'dnf', 'dsq'] })
  status!: 'finished' | 'dnf' | 'dns' | 'dsq';

  // ── F-050 race-ops fields (all optional, graceful undefined) ──

  @ApiPropertyOptional({
    enum: ['road', 'trail', 'ultra_trail'],
    description: 'F-050 PAUSE-50-02: 3 classes — Road / Trail (<50K) / Ultra Trail (≥50K)',
  })
  raceClassification?: 'road' | 'trail' | 'ultra_trail';

  @ApiPropertyOptional({
    description: 'F-050 PAUSE-50-03: elevation gain in meters (D+), undefined if missing',
  })
  elevationGain?: number;

  @ApiPropertyOptional({
    description: 'F-050 PAUSE-50-04: ITRA points (only if > 0 in source; currently never populated, reserved Phase 2 backfill)',
  })
  itraPoints?: number;

  @ApiPropertyOptional({
    description: 'F-050 PAUSE-50-05: gun time (frontend toggleable, default hidden)',
  })
  gunTime?: string;

  @ApiPropertyOptional({
    description: 'F-050 race-ops: AG bracket localized VN label (e.g. "Nữ 30-39")',
  })
  agBracket?: string;
}

export class AthleteProfileResponseDto {
  @ApiProperty({ description: 'Slug format <bib>-<name-kebab>' })
  slug!: string;

  @ApiProperty() canonicalName!: string;

  @ApiProperty() primaryBib!: string;

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'] })
  gender?: string | null;

  @ApiPropertyOptional() province?: string;
  @ApiPropertyOptional() nationality?: string;
  @ApiPropertyOptional() club?: string;
  @ApiPropertyOptional({ description: 'Most recent AG bracket' })
  ageGroupSnapshot?: string;

  @ApiProperty() totalRaces!: number;
  @ApiProperty() totalFinished!: number;
  @ApiProperty() totalDNF!: number;
  @ApiProperty({ description: 'F-047 Phase 1C — DNS count (didn\'t start)' })
  totalDNS!: number;
  @ApiPropertyOptional({ description: 'Future: explicit disqualification count' })
  totalDSQ?: number;

  @ApiProperty({
    type: [AthletePRRecordDto],
    description: '4 distances: 5K/10K/HM/FM (BR-47-09)',
  })
  prRecords!: AthletePRRecordDto[];

  @ApiProperty({
    type: [AthleteRaceHistoryRowDto],
    description: 'Sort by raceDate DESC',
  })
  raceHistory!: AthleteRaceHistoryRowDto[];

  @ApiPropertyOptional() lastRaceDate?: string;
  @ApiPropertyOptional({
    description:
      'Avatar from race_results.avatarUrl (public-shareable F-046 Phase 1.5 precedent)',
  })
  avatarUrl?: string;

  @ApiProperty() computedAt!: string;

  // ── F-050 race-ops aggregations (all optional, frontend hides on undefined) ──

  @ApiPropertyOptional({
    type: AthleteBestAgRankDto,
    description: 'F-050 best AG performance — lowest categoryRank across all finished races',
  })
  bestAgRank?: AthleteBestAgRankDto;

  @ApiPropertyOptional({
    description: 'F-050 PAUSE-50-07: consecutive finished-race streak from most recent (≥5 to qualify badge)',
  })
  streak?: number;

  @ApiPropertyOptional({
    type: [AthleteDistanceSpecialistDto],
    description: 'F-050 PAUSE-50-08: distance specialist groups where finished count ≥3',
  })
  distanceSpecialist?: AthleteDistanceSpecialistDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'F-050: unique provinces visited across finished races (≥3 to qualify geographic badge)',
  })
  provinces?: string[];
}

export class AthletePhotoPublicDto {
  @ApiProperty() id!: string;
  @ApiProperty() s3Url!: string;
  @ApiProperty({ enum: ['selfie', 'bib_photo', 'finish_line'] })
  type!: 'selfie' | 'bib_photo' | 'finish_line';
  @ApiPropertyOptional() raceId?: string;
  @ApiPropertyOptional() bib?: string;
  @ApiProperty() uploadedAt!: string;
}
