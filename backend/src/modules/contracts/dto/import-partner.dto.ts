import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * FEATURE-032 — Partner Excel Import DTOs (mirror F-031 Service Catalog Import).
 *
 * 2-step UX (PAUSE-32-03):
 *   Step 1 (preview): POST /import-excel/preview multipart/form-data file
 *   Step 2 (confirm): POST /import-excel/confirm body { rows[] }
 *
 * Server RE-VALIDATES rows trong confirm step (KHÔNG trust FE).
 * Duplicate detection dual-key (PAUSE-32-02):
 *   - Row có taxId → check by taxId (MST stable, sparse unique candidate)
 *   - Row không taxId → fallback check by entityName exact match
 * Empty/invalid per-row skip + collect errors (PAUSE-32-06).
 * Max 200 rows (PAUSE-32-04).
 */

export class ParsedPartnerRowDto {
  @ApiProperty({ description: 'Excel row number (1-indexed, header=1)' })
  @IsNumber()
  rowNum: number;

  @ApiProperty() @IsString() entityName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() representative?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() position?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankAccount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class InvalidPartnerRowDto {
  @ApiProperty() rowNum: number;
  @ApiProperty({ type: [String] }) errors: string[];
  @ApiProperty() raw: Record<string, unknown>;
}

export class PartnerImportPreviewDto {
  @ApiProperty({ description: 'Total data rows trong Excel (sau header)' })
  total: number;

  @ApiProperty({
    type: [ParsedPartnerRowDto],
    description: 'Rows hợp lệ + chưa trùng → sẽ insert ở Step 2',
  })
  valid: ParsedPartnerRowDto[];

  @ApiProperty({
    type: [ParsedPartnerRowDto],
    description: 'Rows hợp lệ nhưng trùng (taxId hoặc entityName) → SKIP',
  })
  duplicate: ParsedPartnerRowDto[];

  @ApiProperty({
    type: [InvalidPartnerRowDto],
    description: 'Rows fail validation — reported, KHÔNG insert',
  })
  invalid: InvalidPartnerRowDto[];
}

export class PartnerImportConfirmDto {
  @ApiProperty({
    type: [ParsedPartnerRowDto],
    minLength: 1,
    maxLength: 200,
    description: 'Validated rows từ Step 1 preview. Server RE-VALIDATES.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ParsedPartnerRowDto)
  rows: ParsedPartnerRowDto[];
}

export class PartnerImportResultDto {
  @ApiProperty() inserted: number;
  @ApiProperty() skipped_duplicate: number;
  @ApiProperty() failed: number;
}
