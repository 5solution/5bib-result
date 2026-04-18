import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * v1.4 bulk actions map 1:1 to the per-registration transition endpoints:
 *   approve   → approveRegistration (pending_approval → approved → contract_sent)
 *   reject    → rejectRegistration  (pending_approval | approved → rejected)
 *   cancel    → cancelRegistration  (non-terminal → cancelled)
 * Each row is processed sequentially so one bad row doesn't poison the batch.
 */
const BULK_ACTIONS = ['approve', 'reject', 'cancel'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export class BulkUpdateRegistrationsDto {
  @ApiProperty({ type: [Number], maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids!: number[];

  @ApiProperty({ enum: BULK_ACTIONS })
  @IsEnum(BULK_ACTIONS)
  action!: BulkAction;

  @ApiProperty({
    required: false,
    description:
      'Required when action=reject (shown to applicants). Optional for cancel (stored in notes).',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class BulkUpdateResponseDto {
  @ApiProperty() updated!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty({ type: [Number] })
  failed_ids!: number[];
}

export class ExportResponseDto {
  @ApiProperty({ description: 'S3 presigned URL (10 minutes TTL)' })
  download_url!: string;

  @ApiProperty() row_count!: number;
}

export class PersonnelExportResponseDto {
  @ApiProperty({ description: 'S3 presigned URL (10 minutes TTL)' })
  url!: string;

  @ApiProperty({ description: 'Download filename suggested for clients' })
  filename!: string;

  @ApiProperty({ description: 'URL expiry in seconds' })
  expires_in!: number;

  @ApiProperty({ description: 'Number of rows written (after filters)' })
  row_count!: number;
}
