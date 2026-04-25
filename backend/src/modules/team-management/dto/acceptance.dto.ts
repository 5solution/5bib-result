import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SendAcceptanceBatchDto {
  @ApiProperty({
    type: [Number],
    description:
      'Registration IDs scoped to the event whose acceptance to send. Only regs with status=completed are eligible; ineligible IDs are reported in response.skipped.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  registration_ids!: number[];

  @ApiProperty({
    required: false,
    description:
      'Optional override value in VND for all selected regs. When omitted, each reg uses role.unit_price × days_checked_in.',
  })
  @IsInt()
  @Min(0)
  @Max(999_999_999_999)
  @IsOptional()
  acceptance_value?: number;

  @ApiProperty({
    required: false,
    description:
      'Optional template_id override. When omitted, uses the global default acceptance template (event_id=NULL, is_default=TRUE).',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  template_id?: number;
}

export class SendAcceptanceSingleDto {
  @ApiProperty({
    required: false,
    description:
      'Optional override value in VND. When omitted, uses role.unit_price × days_checked_in.',
  })
  @IsInt()
  @Min(0)
  @Max(999_999_999_999)
  @IsOptional()
  acceptance_value?: number;

  @ApiProperty({
    required: false,
    description:
      'Optional template_id override. When omitted, uses the global default acceptance template (event_id=NULL, is_default=TRUE).',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  template_id?: number;
}

export class SendAcceptanceBatchResponseDto {
  @ApiProperty({ description: 'Count of regs transitioned to pending_sign' })
  queued!: number;

  @ApiProperty({
    type: [Number],
    description:
      'Reg IDs skipped (wrong status, missing Bên B fields, already signed, etc.)',
  })
  skipped!: number[];

  @ApiProperty({
    type: [String],
    description: 'Per-reg failure reasons aligned by index with .skipped',
  })
  skip_reasons!: string[];
}

export class AcceptanceViewDto {
  @ApiProperty({ description: 'Fully rendered HTML document (already wrapped)' })
  html_content!: string;

  @ApiProperty({ description: 'Current acceptance_status value' })
  acceptance_status!: 'not_ready' | 'pending_sign' | 'signed' | 'disputed';

  @ApiProperty({ nullable: true })
  signed_at!: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Short-lived presigned URL for the signed PDF. Null when not yet signed.',
  })
  pdf_url!: string | null;

  @ApiProperty({ description: 'Bên B full_name for the signing confirmation' })
  full_name!: string;

  @ApiProperty({ description: 'Contract number this acceptance references' })
  contract_number!: string;

  @ApiProperty({ description: 'Acceptance value in VND' })
  acceptance_value!: number;

  @ApiProperty({ nullable: true, description: 'Dispute reason (if disputed)' })
  notes!: string | null;
}

export class SignAcceptanceDto {
  @ApiProperty({
    description:
      "Full name typed by the crew member — must match registration.full_name exactly (case-insensitive, trimmed).",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  confirmed_name!: string;

  @ApiProperty({
    description:
      'Signature PNG as base64 data URL (data:image/png;base64,...). Max 500KB decoded.',
  })
  @IsString()
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, {
    message: 'signature_image must be a data:image/png;base64,... URL',
  })
  signature_image!: string;
}

export class SignAcceptanceResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ description: 'Presigned URL for the signed acceptance PDF (24h)' })
  pdf_url!: string;

  @ApiProperty()
  signed_at!: string;
}

export class DisputeAcceptanceDto {
  @ApiProperty({
    description:
      'Reason the admin marked the acceptance as disputed. Surfaces in the "Tranh chấp" tab and on the crew status page.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}
