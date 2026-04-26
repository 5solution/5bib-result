import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  PaymentStatus,
  ShirtSize,
} from '../entities/vol-registration.entity';

/**
 * Admin field-level edit DTO. State transitions still go through dedicated
 * endpoints (`/approve`, `/reject`, `/cancel`, `/confirm-completion`,
 * `/payment/mark-paid`, `/payment/force-paid`).
 *
 * v2.1 — extended to cover the full Bên B profile so admin has one form
 * to edit everything (full_name, phone, email, shirt_size + birth_date,
 * cccd_*, bank_*, address). Previously these were split across:
 *   - PATCH /:id              (notes / payment / working_days only)
 *   - PATCH /:id/backfill-ben-b (birth_date / cccd_* / bank_* / address)
 * Now everything optional → admin sends only what changed.
 *
 * Fields stored on entity columns: full_name, phone, email, shirt_size,
 * birth_date, cccd_issue_date, cccd_issue_place, notes, payment_status,
 * actual_working_days.
 *
 * Fields stored inside form_data JSON (legacy origin from public register
 * form): bank_account_number, bank_name, address, cccd_number.
 *
 * The `status` field is intentionally absent — flipping status through
 * the generic PATCH route returns 400 "unknown property".
 */
export class UpdateRegistrationDto {
  // ─── Profile (entity columns) ───
  @ApiProperty({ required: false, minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @IsOptional()
  full_name?: string;

  @ApiProperty({ required: false, maxLength: 20, example: '0900000000' })
  @IsString()
  @Matches(/^[+\d][\d\s().-]{6,19}$/, {
    message: 'phone must be 7-20 digits, may start with + and contain spaces, dots, dashes, or parentheses',
  })
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, maxLength: 255, example: 'crew@example.com' })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  })
  @IsEnum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
  @IsOptional()
  shirt_size?: ShirtSize | null;

  // ─── Bên B contract fields (entity columns) ───
  @ApiProperty({ required: false, nullable: true, example: '1995-06-15' })
  @IsDateString()
  @IsOptional()
  birth_date?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2021-03-01' })
  @IsDateString()
  @IsOptional()
  cccd_issue_date?: string | null;

  @ApiProperty({ required: false, nullable: true, maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  cccd_issue_place?: string | null;

  // ─── Bên B fields stored in form_data JSON ───
  // Keys match the public register form contract (the same keys public
  // register's RegisterDto writes), so editing in admin reads/writes
  // the SAME values that show under "Dữ liệu form".
  //   cccd, dob, address, bank_account_number, bank_holder_name,
  //   bank_name, bank_branch.
  // `dob` is also synced to entity column birth_date (used by contract
  // PDF renderer) — see service for the sync logic.
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Written to form_data.cccd (12-digit national ID)',
  })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  cccd?: string | null;

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
    description: 'Written to form_data.bank_holder_name',
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  bank_holder_name?: string | null;

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
    description: 'Written to form_data.bank_branch',
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  bank_branch?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Written to form_data.address',
  })
  @IsString()
  @MaxLength(512)
  @IsOptional()
  address?: string | null;

  // ─── Existing field-level edits ───
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ enum: ['pending', 'paid'], required: false })
  @IsEnum(['pending', 'paid'])
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiProperty({ required: false, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  actual_working_days?: number;
}
