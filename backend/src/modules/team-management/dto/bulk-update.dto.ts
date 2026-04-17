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

const BULK_STATUSES = ['approved', 'rejected', 'cancelled'] as const;

export class BulkUpdateRegistrationsDto {
  @ApiProperty({ type: [Number], maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids!: number[];

  @ApiProperty({ enum: BULK_STATUSES })
  @IsEnum(BULK_STATUSES)
  status!: (typeof BULK_STATUSES)[number];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
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
