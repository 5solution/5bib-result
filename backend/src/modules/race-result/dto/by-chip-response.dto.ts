import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * F-017 — Request body for POST /race-results/:raceId/by-chip
 */
export class ByChipRequestDto {
  @ApiProperty({ description: 'Raw chip ID from RFID reader (will be UPPER+TRIM normalized)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  chipId!: string;
}

/**
 * F-017 — Response envelope. Same shape as /athlete/:raceId/:bib but adds
 * `bib` echo at top level so the kiosk knows which BIB the chip resolved to
 * before parsing nested `data`.
 */
export class ByChipResponseDto {
  @ApiProperty({ nullable: true, description: 'Resolved BIB number (null if chip not mapped)' })
  bib!: string | null;

  @ApiProperty({ nullable: true, description: 'Public-safe athlete detail (same shape as F-013 /athlete/:raceId/:bib)' })
  data!: Record<string, unknown> | null;

  @ApiProperty()
  success!: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false, description: 'Error code: race-not-mapped | chip-not-found | chip-disabled | athlete-not-found' })
  errorCode?: string;
}
