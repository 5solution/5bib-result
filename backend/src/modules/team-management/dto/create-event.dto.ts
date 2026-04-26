import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

// v1.8 QC fix: clearable optional fields. Frontend sends `null` to explicitly
// wipe the stored value. `ValidateIf(v !== null)` skips the string/email
// validator when null is sent, so null is the universal "clear" signal.
// `undefined` → field omitted → server keeps existing value (PartialType merge).

export class CreateEventDto {
  @ApiProperty() @IsString() @MaxLength(255) event_name!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  race_id?: string | null;

  @ApiProperty() @IsString() @MaxLength(255) location!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber()
  @Min(-90)
  @Max(90)
  location_lat?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber()
  @Min(-180)
  @Max(180)
  location_lng?: number | null;

  @ApiProperty({ default: 500 })
  @IsInt()
  @Min(50)
  @Max(50_000)
  checkin_radius_m: number = 500;

  @ApiProperty({ example: '2026-05-02' }) @IsDateString() event_start_date!: string;

  @ApiProperty({ example: '2026-05-03' }) @IsDateString() event_end_date!: string;

  @ApiProperty({ example: '2026-04-17T00:00:00Z' }) @IsISO8601() registration_open!: string;

  @ApiProperty({ example: '2026-04-30T23:59:59Z' }) @IsISO8601() registration_close!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsEmail()
  @MaxLength(255)
  contact_email?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(50)
  contact_phone?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Public S3 URL of the benefits banner. Upload separately via /team-upload-photo, then pass the URL here. Send null to clear.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(500)
  benefits_image_url?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Plain-text terms & conditions shown on the crew register page. TNV must agree before submitting. Send null to clear.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(20_000)
  terms_conditions?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'HNLL26',
    description:
      'Uppercase letter-code baked into every contract_number issued for this event (format: NNN-{PREFIX}-HDDV/CTV-5BIB). UNIQUE cross-event. Locked after the first contract has been issued — further edits rejected 400.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, {
    message:
      'contract_code_prefix chỉ gồm chữ in hoa và số (A-Z, 0-9), 2–10 ký tự',
  })
  contract_code_prefix?: string | null;
}
