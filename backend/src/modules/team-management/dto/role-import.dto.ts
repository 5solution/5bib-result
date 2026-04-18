import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * A single parsed role row from the import file — shape used both for
 * the preview response AND the confirm request body.
 *
 * `_row` is the 1-based row number in the original file (for UI display).
 * `sort_order` is either explicit from the file or auto-assigned server-side.
 */
export class ParsedRoleRowDto {
  @ApiProperty({ example: 2, description: '1-based row index in the file' })
  @IsInt()
  @Min(1)
  _row!: number;

  @ApiProperty({ example: 'Leader - Hậu Cần' })
  @IsString()
  @MaxLength(100)
  role_name!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  description!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: 9999,
    description: 'Nullable → unlimited slots',
  })
  @IsInt()
  @IsOptional()
  max_slots!: number | null;

  @ApiProperty({ example: 300000, description: 'VND per day' })
  @IsInt()
  @Min(0)
  daily_rate!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  working_days!: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  waitlist_enabled!: boolean;

  @ApiProperty({ example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  sort_order!: number;
}

export class ParsedRoleRowErrorDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  _row!: number;

  @ApiProperty({
    example: 'Crew Y Tế',
    description: 'Raw role_name value (may be empty)',
  })
  role_name!: string;

  @ApiProperty({
    type: [String],
    example: [
      'max_slots phải là số nguyên ≥ 1 và ≤ 9999',
      'Vai trò đã tồn tại trong event này',
    ],
  })
  errors!: string[];
}

export class PreviewRoleImportResponseDto {
  @ApiProperty({ example: 15 })
  total_rows!: number;

  @ApiProperty({ type: [ParsedRoleRowDto] })
  valid_rows!: ParsedRoleRowDto[];

  @ApiProperty({ type: [ParsedRoleRowErrorDto] })
  invalid_rows!: ParsedRoleRowErrorDto[];
}

export class ConfirmRoleImportDto {
  @ApiProperty({ type: [ParsedRoleRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ParsedRoleRowDto)
  rows!: ParsedRoleRowDto[];
}

export class ConfirmRoleImportResponseDto {
  @ApiProperty({ example: 13 })
  created!: number;

  @ApiProperty({
    example: 0,
    description:
      'Rows skipped because a race condition created the role with the same name between preview and confirm',
  })
  skipped!: number;

  @ApiProperty({
    type: 'array',
    description: 'Full roles list for the event after import',
    items: { type: 'object' },
  })
  roles!: unknown[];
}
