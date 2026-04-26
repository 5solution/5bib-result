import { ApiProperty } from '@nestjs/swagger';

/**
 * Single-step station bulk import.
 * Template has 5 columns: station_name, location_description, gps_lat, gps_lng, sort_order.
 * Import scope is per-category (team) — endpoint carries :categoryId.
 */

export class ImportStationsRowInsertedDto {
  @ApiProperty({ description: '1-based data row index (header excluded)' })
  row!: number;

  @ApiProperty() id!: number;

  @ApiProperty() station_name!: string;
}

export class ImportStationsRowSkippedDto {
  @ApiProperty({ description: '1-based data row index' })
  row!: number;

  @ApiProperty() station_name!: string;

  @ApiProperty({
    description:
      'Why skipped: "duplicate_in_file" | "duplicate_in_db"',
  })
  reason!: string;
}

export class ImportStationsRowErrorDto {
  @ApiProperty({ description: '1-based data row index' })
  row!: number;

  @ApiProperty({ type: [String] })
  errors!: string[];
}

export class ImportStationsResponseDto {
  @ApiProperty({ description: 'Total non-empty rows parsed from the file' })
  total_rows!: number;

  @ApiProperty({ type: [ImportStationsRowInsertedDto] })
  inserted!: ImportStationsRowInsertedDto[];

  @ApiProperty({ type: [ImportStationsRowSkippedDto] })
  skipped!: ImportStationsRowSkippedDto[];

  @ApiProperty({ type: [ImportStationsRowErrorDto] })
  errors!: ImportStationsRowErrorDto[];
}
