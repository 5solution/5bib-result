import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * FEATURE-031 — Service Catalog Excel Import DTOs.
 *
 * 2-step UX:
 *   Step 1 (preview): POST /import-excel/preview multipart/form-data file
 *                     → ServiceCatalogImportPreviewDto (parsed + validated, NO insert)
 *   Step 2 (confirm): POST /import-excel/confirm body { rows[] }
 *                     → ServiceCatalogImportResultDto (after bulk insert)
 *
 * Server RE-VALIDATES rows trong confirm step (KHÔNG trust FE).
 * Duplicate detection by `name + category` pair — Skip + report (PAUSE-31-02).
 * Empty value handling per-row skip + report (PAUSE-31-06).
 * Max 200 rows per import (PAUSE-31-04).
 */

const CATEGORIES = ['TIMING', 'RACEKIT', 'OPERATIONS', 'GENERAL'];

/** Single parsed + validated row ready for insert. */
export class ParsedServiceCatalogRowDto {
  @ApiProperty({ description: 'Excel row number (1-indexed, header=1)' })
  @IsNumber()
  rowNum: number;

  @ApiProperty() @IsString() name: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category: string;

  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) referencePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) referenceCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

/** Row that failed validation — reported back to admin với error list. */
export class InvalidServiceCatalogRowDto {
  @ApiProperty({ description: 'Excel row number (1-indexed)' })
  rowNum: number;

  @ApiProperty({ type: [String], description: 'Validation error messages (VN)' })
  errors: string[];

  @ApiProperty({
    description: 'Raw cell values for admin debug (name, category, etc.)',
  })
  raw: Record<string, unknown>;
}

/** Response của Step 1 preview — parsed + categorized. */
export class ServiceCatalogImportPreviewDto {
  @ApiProperty({ description: 'Total data rows trong Excel (sau header)' })
  total: number;

  @ApiProperty({
    type: [ParsedServiceCatalogRowDto],
    description: 'Rows hợp lệ + chưa trùng → sẽ insert ở Step 2',
  })
  valid: ParsedServiceCatalogRowDto[];

  @ApiProperty({
    type: [ParsedServiceCatalogRowDto],
    description: 'Rows hợp lệ nhưng trùng name+category → SKIP, KHÔNG insert',
  })
  duplicate: ParsedServiceCatalogRowDto[];

  @ApiProperty({
    type: [InvalidServiceCatalogRowDto],
    description: 'Rows fail validation — reported, KHÔNG insert',
  })
  invalid: InvalidServiceCatalogRowDto[];
}

/** Request body của Step 2 confirm — rows từ preview valid array. */
export class ServiceCatalogImportConfirmDto {
  @ApiProperty({
    type: [ParsedServiceCatalogRowDto],
    minLength: 1,
    maxLength: 200,
    description: 'Validated rows từ Step 1 preview. Server RE-VALIDATES.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ParsedServiceCatalogRowDto)
  rows: ParsedServiceCatalogRowDto[];
}

/** Response của Step 2 confirm — after MongoDB bulk insert. */
export class ServiceCatalogImportResultDto {
  @ApiProperty({ description: 'Số dịch vụ đã insert thành công' })
  inserted: number;

  @ApiProperty({
    description:
      'Số rows bị skip do trùng (re-check server-side sau preview, race với manual create)',
  })
  skipped_duplicate: number;

  @ApiProperty({
    description:
      'Số rows failed at insert layer (vd: validation server-side reject)',
  })
  failed: number;
}
