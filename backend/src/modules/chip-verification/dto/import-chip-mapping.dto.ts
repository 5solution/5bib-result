import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportPreviewRowErrorDto {
  @ApiProperty({
    example: 5,
    description: '1-based line number in CSV. 0 means file-level (no specific row).',
  })
  row: number;

  @ApiProperty({ example: 'Invalid chip_id format' })
  reason: string;
}

export class ImportPreviewRowWarningDto {
  @ApiProperty({ example: 5 })
  row: number;

  @ApiProperty({
    example: 'BIB 1234 not yet in athletes table — will resolve at lookup time',
  })
  reason: string;
}

export class ImportPreviewResponseDto {
  @ApiProperty({ example: 1234 })
  totalRows: number;

  @ApiProperty({ example: 1230 })
  valid: number;

  @ApiProperty({ example: 800 })
  toCreate: number;

  @ApiProperty({ example: 50 })
  toUpdate: number;

  @ApiProperty({ example: 380 })
  toSkip: number;

  @ApiProperty({
    description:
      'Number of soft-deleted mappings to make room for bib reassignment.',
    example: 0,
  })
  swapDeletes: number;

  @ApiProperty({
    type: [ImportPreviewRowErrorDto],
    description: 'Errors that BLOCKED the row from being imported.',
  })
  errors: ImportPreviewRowErrorDto[];

  @ApiProperty({
    type: [ImportPreviewRowWarningDto],
    description: 'Warnings — row WAS still imported but flagged for review.',
  })
  warnings: ImportPreviewRowWarningDto[];

  @ApiProperty({ description: '32-char base64url. TTL 10m.' })
  previewToken: string;
}

export class ConfirmImportRequestDto {
  @ApiProperty({ description: 'Token returned from preview endpoint.' })
  // class-validator decorators REQUIRED — global ValidationPipe whitelist:true
  // strips properties without decorators, causing "Preview expired" because
  // controller receives `previewToken: undefined`.
  @IsString()
  @IsNotEmpty()
  previewToken: string;
}

export class ConfirmImportResponseDto {
  @ApiProperty({ example: 1230 })
  imported: number;
}
