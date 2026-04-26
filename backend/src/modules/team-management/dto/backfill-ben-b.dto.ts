import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Admin-only payload to backfill Bên B (party-B) fields required for
 * contract + acceptance rendering. All fields optional — admin fills
 * whichever are missing.
 *
 * - birth_date / cccd_issue_date: ISO date strings (YYYY-MM-DD)
 * - cccd_issue_place: "Cục CSQLHC về TTXH" etc.
 * - bank_account_number / bank_name / address: stored inside
 *   vol_registration.form_data (JSON), since they originated there.
 */
export class BackfillBenBDto {
  @ApiProperty({ required: false, nullable: true, example: '1995-06-15' })
  @IsDateString()
  @IsOptional()
  birth_date?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2021-03-01' })
  @IsDateString()
  @IsOptional()
  cccd_issue_date?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  cccd_issue_place?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Written to form_data.bank_account_number',
  })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  bank_account_number?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Written to form_data.bank_name',
  })
  @IsString()
  @MaxLength(128)
  @IsOptional()
  bank_name?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Written to form_data.address',
  })
  @IsString()
  @MaxLength(512)
  @IsOptional()
  address?: string | null;
}
