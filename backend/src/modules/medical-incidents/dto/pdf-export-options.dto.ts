import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * F-018 BR-MI-29..30 — PDF export options.
 * Phase 1 sync generation + 30s timeout (A5 decision). Phase 2 BullMQ for >150 incidents.
 */
export class PdfExportOptionsDto {
  /** Specific incident IDs (empty/omitted = full race batch). */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  incidentIds?: string[];

  /** Include witness statements + photos appendix (default true for insurance audit). */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeAppendix?: boolean = true;

  /** Embed signature page (Race Medical Director). */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSignature?: boolean = true;
}
