import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CLOSURE_REASONS,
  ClosureReason,
  IncidentState,
  STATES,
} from '../schemas/medical-incident.schema';
import {
  GpsLocationDto,
  MedicalDirectorSignatureDto,
  WitnessStatementDto,
} from './create-incident.dto';

/**
 * F-018 BR-MI-11..16 — state transition request.
 * Service validates: forward-only matrix, Sev 4-5 must hit MEDIC_ON_SITE/AMB_REQUESTED
 * before resolving, FALSE_ALARM Race Director only, witness statements ≥2 for Sev 4-5
 * closure.
 */
export class UpdateIncidentStatusDto {
  @ApiProperty({ enum: STATES })
  @IsIn(STATES as unknown as readonly string[])
  to: IncidentState;

  /** Required when downgrading severity, FALSE_ALARM, or Race Director rollback. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reasonNote?: string;

  /** Required only when transitioning into CLOSED. */
  @ApiPropertyOptional({ enum: CLOSURE_REASONS })
  @IsOptional()
  @IsIn(CLOSURE_REASONS as unknown as readonly string[])
  closureReason?: ClosureReason;

  /** GPS at moment of transition (advisory §3.C — useful for medic-on-site verification). */
  @ApiPropertyOptional({ type: GpsLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GpsLocationDto)
  gps?: GpsLocationDto;

  /** F-018 A1 — multi-medic append on MEDIC_DISPATCHED / MEDIC_ON_SITE. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medicsToAssign?: string[];

  /** F-018 A2 — witness statements (server enforces ≥2 for Sev 4-5 CLOSED). */
  @ApiPropertyOptional({ type: [WitnessStatementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WitnessStatementDto)
  witnessStatements?: WitnessStatementDto[];

  /** F-018 A3 — typed-name signature (Phase 1, required at CLOSED transition). */
  @ApiPropertyOptional({ type: MedicalDirectorSignatureDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalDirectorSignatureDto)
  medicalDirectorSignature?: MedicalDirectorSignatureDto;

  /** Severity escalation (1→3, 2→4) inline at transition (advisory §1.D). */
  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5] })
  @IsOptional()
  newSeverity?: 1 | 2 | 3 | 4 | 5;
}
