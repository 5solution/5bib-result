import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

/**
 * F-015 — Check-In Kiosk DTOs.
 *
 * BR-CK-10 CMND PII boundary:
 *  - Lookup-by-cmnd accepts EXACTLY 4 digits in `value`.
 *  - Backend validates `Length(4, 4) + numeric-only` here at controller boundary.
 *  - Controller / service NEVER log the value (no Logger.log calls in payload paths).
 */

export class LookupRequestDto {
  @ApiProperty({
    description:
      'Lookup query value. For BIB: digits-only up to 6 chars. For CMND: ' +
      'EXACTLY 4 digits (last-4 only — never full CMND). For QR: scanned text payload.',
    example: '1234',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  value: string;
}

export class CmndLookupRequestDto extends LookupRequestDto {
  @ApiProperty({
    description: 'CMND last 4 digits (PII boundary — last-4 only).',
    example: '7891',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Length(4, 4)
  override value: string;
}

export class AthletePreviewDto {
  @ApiProperty() athleteId: number;
  @ApiProperty() bib: string;
  @ApiProperty() name: string;
  @ApiProperty({ required: false, nullable: true }) course?: string | null;
  @ApiProperty({ required: false, nullable: true }) courseDistance?: string | null;
  @ApiProperty({ required: false, nullable: true }) gender?: string | null;
  @ApiProperty({ required: false, nullable: true }) size?: string | null;
  @ApiProperty({ required: false, nullable: true }) items?: string | null;
  @ApiProperty() racekitReceived: boolean;
  @ApiProperty({ required: false, nullable: true }) racekitReceivedAt?: string | null;
  @ApiProperty({ required: false, nullable: true }) pickedUpAtStation?: string | null;
  @ApiProperty({ required: false }) chipVerified?: boolean;
}

export class LookupResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty({
    description: 'Single athlete (BIB / QR exact match), array (CMND fuzzy candidates), or null (not found).',
    type: AthletePreviewDto,
    isArray: false,
    nullable: true,
  })
  data: AthletePreviewDto | AthletePreviewDto[] | null;
  @ApiProperty({ required: false }) message?: string;
}

export class ConfirmRequestDto {
  @ApiProperty({ description: 'Station ID 1..10' })
  @IsString()
  @MinLength(1)
  @MaxLength(3)
  stationId: string;

  @ApiProperty({ enum: ['qr', 'bib', 'cmnd'] })
  @IsString()
  source: 'qr' | 'bib' | 'cmnd';

  @ApiProperty({ description: 'Athlete id (numeric — RaceAthlete.athletes_id).' })
  athleteId: number | string;
}

export class ConfirmResultDto {
  @ApiProperty() bib: string;
  @ApiProperty() athleteId: number;
  @ApiProperty() checkedInAt: string;
  @ApiProperty() stationId: string;
  @ApiProperty({ enum: ['qr', 'bib', 'cmnd'] }) source: 'qr' | 'bib' | 'cmnd';
}

export class ConfirmResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty({ type: ConfirmResultDto, required: false })
  data?: ConfirmResultDto;
  @ApiProperty({ required: false }) message?: string;
}
