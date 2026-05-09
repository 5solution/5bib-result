import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CATEGORIES,
  Category,
  GPS_SOURCES,
  GpsSource,
  Severity,
  SEVERITIES,
  TRAUMA_SUBTYPES,
  TraumaSubtype,
} from '../schemas/medical-incident.schema';

export class GpsLocationDto {
  @ApiProperty({ example: 21.0285, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 105.8542, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ enum: GPS_SOURCES })
  @IsIn(GPS_SOURCES as unknown as readonly string[])
  source: GpsSource;

  @ApiPropertyOptional() @IsOptional() @IsString() aidStationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() accuracyMeters?: number;
}

export class WitnessStatementDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) statement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) contact?: string;
}

export class MedicalDirectorSignatureDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name: string;
  @ApiProperty() @IsDateString() signedAt: string;
}

/**
 * F-018 BR-MI-23..25 — at least one of (bib / athleteName / description) MUST be non-empty.
 * Service layer enforces (DTO-level cross-field check best done in service guard).
 */
export class CreateIncidentDto {
  @ApiProperty({ enum: SEVERITIES, example: 3 })
  @IsInt()
  @IsIn(SEVERITIES as unknown as readonly number[])
  severity: Severity;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES as unknown as readonly string[])
  category: Category;

  @ApiPropertyOptional({ enum: TRAUMA_SUBTYPES })
  @IsOptional()
  @IsIn(TRAUMA_SUBTYPES as unknown as readonly string[])
  traumaSubtype?: TraumaSubtype;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) bib?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) athleteName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;

  @ApiProperty({ type: GpsLocationDto })
  @ValidateNested()
  @Type(() => GpsLocationDto)
  gpsLocation: GpsLocationDto;

  /** F-018 A1 — multi-medic array from M0. Optional at create. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medicalTeamAssigned?: string[];

  /** F-018 A2 — witness statements. ≥2 enforced ONLY at Sev 4-5 closure transition. */
  @ApiPropertyOptional({ type: [WitnessStatementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WitnessStatementDto)
  witnessStatements?: WitnessStatementDto[];

  /**
   * Pre-uploaded photo S3 keys (frontend uploads via /photo endpoint first,
   * then references keys here). Sev 4-5 must include ≥1 (BR-MI-26).
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentKeys?: string[];

  /** Client-side reportedAt (offline-queued submission timestamp). Defaults to server time. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reportedAt?: string;
}
