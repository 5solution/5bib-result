import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
} from 'class-validator';

/**
 * FEATURE-025 — Bulk delete reconciliations by IDs.
 * Max 50 IDs per request (PAUSE-25-05 — enough for 1 page list).
 */
export class DeleteBatchDto {
  @ApiProperty({
    description: 'Array of reconciliation MongoDB ObjectId strings (max 50)',
    type: [String],
    minItems: 1,
    maxItems: 50,
    example: ['69f9488ab13b71f5c5f970ec', '69fdbab606b3935acf24ccf6'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  ids: string[];
}

export class DeleteBatchResponseDto {
  @ApiProperty({
    description: 'Number of reconciliations actually deleted',
    example: 3,
  })
  deleted: number;

  @ApiProperty({
    description:
      'Number of IDs requested but not found (idempotent — already deleted or never existed)',
    example: 0,
  })
  not_found: number;
}
