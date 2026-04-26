import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * One parsed row from the upload, with any per-row validation errors/warnings.
 * `row_num` is the 1-based Excel row number *after* the header — row_num=1 is
 * the first data row (so a user sees "Dòng 1" matching their sheet row 2).
 */
export class ImportRegistrationsPreviewRow {
  @ApiProperty({ example: 1, description: '1-based data row index (header excluded)' })
  row_num!: number;

  @ApiProperty({
    description: 'Parsed row data keyed by column header (trimmed lowercase)',
    type: 'object',
    additionalProperties: true,
  })
  data!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  errors!: string[];

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiProperty()
  valid!: boolean;

  @ApiProperty({
    enum: ['none', 'in_file', 'in_db'],
    nullable: true,
    example: 'none',
  })
  duplicate_kind!: 'none' | 'in_file' | 'in_db' | null;

  @ApiProperty({ required: false, nullable: true, type: Number })
  resolved_role_id?: number | null;
}

export class ImportRegistrationsPreviewResponseDto {
  @ApiProperty({ example: 12 })
  total_rows!: number;

  @ApiProperty({ example: 9 })
  valid_count!: number;

  @ApiProperty({ example: 2 })
  invalid_count!: number;

  @ApiProperty({ example: 1 })
  duplicate_in_file!: number;

  @ApiProperty({ example: 0 })
  duplicate_in_db!: number;

  @ApiProperty({ type: [ImportRegistrationsPreviewRow] })
  rows!: ImportRegistrationsPreviewRow[];

  @ApiProperty({
    description: 'Opaque token — pass back to /confirm within 10 minutes',
    example: '9e4b0f0a-7b11-4a71-a0e7-9b3a1d2e5f64',
  })
  import_token!: string;
}

export class ConfirmImportRegistrationsDto {
  @ApiProperty({ description: 'Token from /preview response' })
  @IsString()
  import_token!: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'When true, inserted rows land in approved and the contract-send chain fires async.',
  })
  @IsOptional()
  @IsBoolean()
  auto_approve?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'When true, skip rows with errors/duplicates and insert only the valid ones. Otherwise fail if any invalid.',
  })
  @IsOptional()
  @IsBoolean()
  skip_invalid?: boolean;

  @ApiProperty({
    required: false,
    default: true,
    description:
      'When true, fire welcome email to each imported TNV with magic link + dynamic list of missing fields.',
  })
  @IsOptional()
  @IsBoolean()
  send_welcome_email?: boolean;
}

export class ConfirmImportRegistrationsResponseDto {
  @ApiProperty({ example: 9 })
  inserted!: number;

  @ApiProperty({ example: 3 })
  skipped!: number;

  @ApiProperty({ type: [Number], description: 'IDs of inserted registrations' })
  inserted_ids!: number[];

  @ApiProperty({ type: [String], description: 'Per-row errors encountered during insert' })
  errors!: string[];

  @ApiProperty({
    example: 5,
    description:
      'v1.6: how many inserted registrations were also assigned to a station via the station_id column.',
  })
  assigned!: number;
}
