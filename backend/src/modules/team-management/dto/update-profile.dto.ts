import { ApiProperty } from '@nestjs/swagger';
import {
  IsMobilePhone,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * v1.4.1 — TNV self-service profile edit.
 *
 * Submitted via PATCH /public/team-registration/:token/profile. Backend
 * behaviour depends on current status:
 *   - pending_approval → apply directly to main fields (admin hasn't
 *     committed yet, so no separate approval loop needed).
 *   - approved+        → stored in pending_changes JSON + flag raised,
 *     admin must call /approve-changes or /reject-changes.
 *
 * Email is IMMUTABLE (part of uq_email_role) — client must not send.
 */
export class UpdateProfileDto {
  @ApiProperty({ required: false, minLength: 2, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  full_name?: string;

  @ApiProperty({ required: false, example: '0901234567' })
  @IsOptional()
  @IsMobilePhone('vi-VN')
  phone?: string;

  @ApiProperty({
    required: false,
    description:
      'Dynamic fields matching role.form_fields. Photos must be uploaded first via /team-upload-photo and passed as S3 keys.',
    type: Object,
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  form_data?: Record<string, unknown>;
}

export class UpdateProfileResponseDto {
  @ApiProperty({
    enum: ['applied', 'pending_admin_approval'],
    description:
      'applied = changes landed directly (still pending_approval). pending_admin_approval = stored, awaiting admin.',
  })
  outcome!: 'applied' | 'pending_admin_approval';

  @ApiProperty() message!: string;

  @ApiProperty({ required: false, nullable: true })
  pending_changes_submitted_at!: string | null;
}
