import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ChipLookupQueryDto {
  @ApiProperty({
    description:
      '4-32 chars alphanumeric + hyphen + underscore, normalized UPPER+TRIM server-side.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/, {
    message: 'chip_id must be 4-32 chars alphanumeric/_/- (no leading dash)',
  })
  chip_id: string;

  @ApiPropertyOptional({ description: 'Bàn 2 station label, max 64 chars.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  device?: string;
}

/**
 * Public response. STRICT ALLOWLIST per BR-03.
 * NEVER add: email, phone, cccd, dob, cmnd, passport, address, ip.
 */
export class ChipLookupResponseDto {
  @ApiProperty({
    enum: [
      'FOUND',
      'CHIP_NOT_FOUND',
      'BIB_UNASSIGNED',
      'DISABLED',
      'ALREADY_PICKED_UP',
    ],
  })
  result:
    | 'FOUND'
    | 'CHIP_NOT_FOUND'
    | 'BIB_UNASSIGNED'
    | 'DISABLED'
    | 'ALREADY_PICKED_UP';

  @ApiProperty({ nullable: true })
  bib_number: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Display name: name_on_bib || athletes.name',
  })
  name: string | null;

  @ApiProperty({ nullable: true, example: '21KM' })
  course_name: string | null;

  @ApiProperty({ nullable: true })
  team: string | null;

  @ApiProperty({ nullable: true })
  last_status: string | null;

  @ApiProperty({ description: 'Whether athlete already picked up racekit.' })
  racekit_received: boolean;

  @ApiProperty({
    description:
      'Atomic SETNX guarantee — exactly ONE thread sees true per (race, athlete).',
  })
  is_first_verify: boolean;

  @ApiProperty()
  verified_at: Date;
}

export class ChipRecentItemDto {
  @ApiProperty({ nullable: true })
  bib_number: string | null;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  course_name: string | null;

  @ApiProperty()
  result: string;

  @ApiProperty()
  verified_at: Date;

  @ApiProperty({ nullable: true })
  device_label: string | null;

  @ApiProperty()
  is_first_verify: boolean;
}

export class ChipRecentResponseDto {
  @ApiProperty({ type: [ChipRecentItemDto] })
  items: ChipRecentItemDto[];
}

export class ChipStatsResponseDto {
  @ApiProperty({ description: 'Total active mappings imported.' })
  total_mappings: number;

  @ApiProperty({ description: 'Distinct athletes verified at least once (FOUND).' })
  total_verified: number;

  @ApiProperty({ description: 'Total verify attempts (incl. duplicates).' })
  total_attempts: number;

  @ApiProperty({ description: 'Verifications in last 5 minutes.' })
  recent_5m: number;
}
