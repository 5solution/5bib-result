import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ACTOR_ROLES,
  ActorRole,
  CATEGORIES,
  CLOSURE_REASONS,
  Category,
  ClosureReason,
  GPS_SOURCES,
  GpsSource,
  IncidentState,
  Severity,
  STATES,
  TraumaSubtype,
  TRAUMA_SUBTYPES,
} from '../schemas/medical-incident.schema';

export class GpsLocationResponseDto {
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ enum: GPS_SOURCES }) source: GpsSource;
  @ApiPropertyOptional() aidStationId?: string;
  @ApiPropertyOptional() accuracyMeters?: number;
}

export class IncidentTransitionResponseDto {
  @ApiProperty() from: string;
  @ApiProperty({ enum: STATES }) to: IncidentState;
  @ApiProperty() actorId: string;
  @ApiProperty({ enum: ACTOR_ROLES }) actorRole: ActorRole;
  @ApiProperty() at: string;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional({ type: GpsLocationResponseDto }) gps?: GpsLocationResponseDto;
}

export class IncidentAttachmentResponseDto {
  @ApiProperty() s3Key: string;
  @ApiProperty() mime: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() uploadedAt: string;
  @ApiPropertyOptional() signedUrl?: string;
}

export class WitnessStatementResponseDto {
  @ApiProperty() name: string;
  @ApiPropertyOptional() statement?: string;
  @ApiPropertyOptional() contact?: string;
  @ApiProperty() signedAt: string;
}

export class MedicalDirectorSignatureResponseDto {
  @ApiProperty() name: string;
  @ApiProperty() signedAt: string;
}

/**
 * F-018 BR-MI-32 — role-gated PII redaction.
 * Non-medical roles (operator/Back-Office Admin without role) get redacted
 * variant where `athleteName`, `description`, `attachments[]` are stripped.
 * Service layer applies this filter pre-response.
 */
export class IncidentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() raceId: string;

  @ApiPropertyOptional() bib?: string;
  @ApiPropertyOptional() athleteName?: string;

  @ApiProperty({ enum: [1, 2, 3, 4, 5] }) severity: Severity;
  @ApiProperty({ enum: CATEGORIES }) category: Category;
  @ApiPropertyOptional({ enum: TRAUMA_SUBTYPES }) traumaSubtype?: TraumaSubtype;
  @ApiPropertyOptional() description?: string;

  @ApiProperty({ type: GpsLocationResponseDto }) gpsLocation: GpsLocationResponseDto;

  @ApiProperty() reportedByUserId: string;
  @ApiProperty() reportedAt: string;

  @ApiProperty({ enum: STATES }) state: IncidentState;
  @ApiPropertyOptional({ enum: CLOSURE_REASONS }) closureReason?: ClosureReason;

  @ApiProperty({ type: [IncidentTransitionResponseDto] })
  incidentTransitions: IncidentTransitionResponseDto[];

  @ApiProperty({ type: [String] }) medicalTeamAssigned: string[];
  @ApiProperty({ type: [WitnessStatementResponseDto] })
  witnessStatements: WitnessStatementResponseDto[];

  @ApiPropertyOptional({ type: MedicalDirectorSignatureResponseDto })
  medicalDirectorSignature?: MedicalDirectorSignatureResponseDto;

  @ApiProperty({ type: [IncidentAttachmentResponseDto] })
  attachments: IncidentAttachmentResponseDto[];

  @ApiPropertyOptional() ambulanceETA?: string;
  @ApiPropertyOptional() medicArrivedAt?: string;
  @ApiPropertyOptional() outcome?: string;

  @ApiProperty() anonymized: boolean;
  @ApiPropertyOptional() latestPdfS3Key?: string;

  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class IncidentListResponseDto {
  @ApiProperty({ type: [IncidentResponseDto] }) items: IncidentResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() limit: number;
  @ApiProperty() offset: number;
  /** BR-MI-33 — count of incidents in active states (NOT in CLOSED). */
  @ApiProperty() activeCount: number;
}

export class PdfExportResponseDto {
  @ApiProperty() s3Key: string;
  @ApiProperty() signedUrl: string;
  @ApiProperty() expiresAtIso: string;
  @ApiProperty() incidentCount: number;
  @ApiProperty() warning?: string;
}
