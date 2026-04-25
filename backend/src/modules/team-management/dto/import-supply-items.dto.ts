import { ApiProperty } from '@nestjs/swagger';

/**
 * Single-step supply items import.
 *
 * Unlike registrations (preview → confirm), supply items have 2 required
 * fields and simple duplicate rules, so we collapse to one upload call.
 * Admin can re-upload trivially if anything was wrong.
 */

export class ImportSupplyItemsRowInsertedDto {
  @ApiProperty({ description: '1-based data row index (header excluded)' })
  row!: number;

  @ApiProperty() id!: number;

  @ApiProperty() item_name!: string;

  @ApiProperty() unit!: string;
}

export class ImportSupplyItemsRowSkippedDto {
  @ApiProperty({ description: '1-based data row index' })
  row!: number;

  @ApiProperty() item_name!: string;

  @ApiProperty({
    description:
      'Why the row was skipped. Either "duplicate_in_file" or "duplicate_in_db".',
  })
  reason!: string;
}

export class ImportSupplyItemsRowErrorDto {
  @ApiProperty({ description: '1-based data row index' })
  row!: number;

  @ApiProperty({ type: [String] })
  errors!: string[];
}

export class ImportSupplyItemsResponseDto {
  @ApiProperty({ description: 'Total non-empty rows parsed from the file' })
  total_rows!: number;

  @ApiProperty({ type: [ImportSupplyItemsRowInsertedDto] })
  inserted!: ImportSupplyItemsRowInsertedDto[];

  @ApiProperty({ type: [ImportSupplyItemsRowSkippedDto] })
  skipped!: ImportSupplyItemsRowSkippedDto[];

  @ApiProperty({ type: [ImportSupplyItemsRowErrorDto] })
  errors!: ImportSupplyItemsRowErrorDto[];
}
