import { ApiProperty } from '@nestjs/swagger';
import type {
  ContractStatus,
  PaymentStatus,
  RegistrationStatus,
  ShirtSize,
} from '../entities/vol-registration.entity';

/**
 * Shape returned from admin list endpoints. Sensitive fields are stripped:
 *   - cccd_photo_url   → omitted (admin must call /detail for presigned URL)
 *   - magic_token      → omitted (credential)
 *   - qr_code          → omitted (same value as magic_token)
 *   - form_data.cccd   → masked to `***<last4>`
 */
export class RegistrationListRowDto {
  @ApiProperty() id!: number;
  @ApiProperty() role_id!: number;
  @ApiProperty({ required: false, nullable: true }) role_name!: string | null;
  @ApiProperty() event_id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ required: false, nullable: true })
  shirt_size!: ShirtSize | null;
  @ApiProperty({ required: false, nullable: true })
  avatar_photo_url!: string | null;
  @ApiProperty() status!: RegistrationStatus;
  @ApiProperty({ required: false, nullable: true })
  waitlist_position!: number | null;
  @ApiProperty() contract_status!: ContractStatus;
  @ApiProperty({ required: false, nullable: true })
  checked_in_at!: string | null;
  @ApiProperty() payment_status!: PaymentStatus;
  @ApiProperty({ required: false, nullable: true })
  actual_working_days!: number | null;
  @ApiProperty({ required: false, nullable: true })
  actual_compensation!: string | null;
  @ApiProperty({
    description: 'Form answers. CCCD is masked to ***<last4>.',
    type: 'object',
    additionalProperties: true,
  })
  form_data!: Record<string, unknown>;
  @ApiProperty({ required: false, nullable: true })
  notes!: string | null;
  @ApiProperty() created_at!: string;

  // v1.4.1 — admin list indicator for pending profile-edit requests.
  @ApiProperty({ description: 'True when TNV has an unapproved profile edit.' })
  has_pending_changes!: boolean;
}

export class ListRegistrationsResponseDto {
  @ApiProperty({ type: [RegistrationListRowDto] })
  data!: RegistrationListRowDto[];
  @ApiProperty() total!: number;

  /**
   * Count-per-status map for building filter tabs, e.g.
   * `{ pending_approval: 12, approved: 3, contract_sent: 8, ... }`.
   * Keys cover all 10 operational statuses — missing keys imply 0.
   */
  @ApiProperty({
    description:
      'Count per status across the full result set (ignores pagination). Used for filter tabs.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: {
      pending_approval: 12,
      approved: 3,
      contract_sent: 8,
      contract_signed: 15,
      qr_sent: 5,
      checked_in: 2,
      completed: 0,
      waitlisted: 0,
      rejected: 0,
      cancelled: 0,
    },
  })
  by_status!: Record<string, number>;
}
