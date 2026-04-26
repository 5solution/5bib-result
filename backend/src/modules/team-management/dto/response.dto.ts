import { ApiProperty } from '@nestjs/swagger';

export class PublicRoleSummaryDto {
  @ApiProperty() id!: number;
  @ApiProperty() role_name!: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty() max_slots!: number;
  @ApiProperty() filled_slots!: number;
  @ApiProperty() is_full!: boolean;
  @ApiProperty() waitlist_enabled!: boolean;
  @ApiProperty() daily_rate!: number;
  @ApiProperty() working_days!: number;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  form_fields!: unknown[];
}

export class PublicEventSummaryDto {
  @ApiProperty() id!: number;
  @ApiProperty() event_name!: string;
  @ApiProperty({ required: false }) description?: string | null;
  @ApiProperty({ required: false }) location?: string | null;
  @ApiProperty() event_start_date!: string;
  @ApiProperty() event_end_date!: string;
  @ApiProperty() registration_open!: string;
  @ApiProperty() registration_close!: string;
  @ApiProperty({ required: false, nullable: true })
  benefits_image_url?: string | null;
  @ApiProperty({ required: false, nullable: true })
  terms_conditions?: string | null;
  @ApiProperty({ type: [PublicRoleSummaryDto] })
  roles!: PublicRoleSummaryDto[];
}

export class RegisterResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty({ enum: ['pending_approval', 'approved', 'waitlisted'] })
  status!: 'pending_approval' | 'approved' | 'waitlisted';
  @ApiProperty({ required: false, nullable: true })
  waitlist_position!: number | null;
  @ApiProperty() message!: string;
  /**
   * SECURITY: only populated on admin-auth'd manual-register responses.
   * The public /team-register endpoint MUST NOT return this — the portal
   * token is delivered to the crew member by email after approval, never
   * echoed to the anonymous register caller.
   */
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Magic link to the crew portal. Populated only for admin manual-register responses. Public register responses omit this to prevent token leaks.',
  })
  magic_link?: string | null;
}

export class StatusResponseDto {
  @ApiProperty() full_name!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty() event_name!: string;
  @ApiProperty({
    enum: [
      'pending_approval',
      'approved',
      'contract_sent',
      'contract_signed',
      'qr_sent',
      'checked_in',
      'completed',
      'waitlisted',
      'rejected',
      'cancelled',
    ],
  })
  status!: string;
  @ApiProperty({ required: false, nullable: true })
  waitlist_position!: number | null;
  @ApiProperty({ enum: ['not_sent', 'sent', 'signed', 'expired'] })
  contract_status!: string;
  @ApiProperty({ required: false, nullable: true })
  checked_in_at!: string | null;
  @ApiProperty({ required: false, nullable: true, description: 'Base64 PNG' })
  qr_code!: string | null;

  // v1.4.1 — profile-edit fields so the crew UI can show the banner + form.
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ required: false, nullable: true })
  avatar_photo_url!: string | null;
  // v037+ — surfaced so crew banner can detect missing profile fields.
  @ApiProperty({ required: false, nullable: true })
  cccd_photo_url!: string | null;
  @ApiProperty({ required: false, nullable: true })
  cccd_back_photo_url!: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  birth_date!: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  cccd_issue_date!: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  cccd_issue_place!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Submitted form answers. CCCD number is masked to `***<last4>` on the public endpoint.',
  })
  form_data!: Record<string, unknown>;
  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'Role form-field schema so the UI can render the edit form.',
  })
  form_fields!: unknown[];
  @ApiProperty({
    description: 'True if the TNV has submitted changes awaiting admin approval.',
  })
  has_pending_changes!: boolean;
  @ApiProperty({ required: false, nullable: true })
  pending_changes_submitted_at!: string | null;
  @ApiProperty({
    required: false,
    nullable: true,
    type: Object,
    additionalProperties: true,
    description:
      'The proposed field patch the TNV submitted. Null when nothing is pending.',
  })
  pending_changes!: Record<string, unknown> | null;

  // v1.5 — group chat hint/link. `chat_platform` is always exposed (so the UI
  // can render the right icon even when the link is hidden). `chat_group_url`
  // is only visible once the TNV has signed the contract (BR-CHAT-02).
  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['zalo', 'telegram', 'whatsapp', 'other'],
  })
  chat_platform!: 'zalo' | 'telegram' | 'whatsapp' | 'other' | null;

  @ApiProperty({ required: false, nullable: true })
  chat_group_url!: string | null;

  // v2.0 — Acceptance + payment surfacing so the status page can render
  // the "Nghiệm thu & Thanh toán" section. `acceptance_notes` carries the
  // dispute reason when acceptance_status='disputed'.
  @ApiProperty({
    enum: ['not_ready', 'pending_sign', 'signed', 'disputed'],
    description:
      'Acceptance (biên bản nghiệm thu) gate. Payment cannot be marked paid until status=signed unless admin force-pays.',
  })
  acceptance_status!: 'not_ready' | 'pending_sign' | 'signed' | 'disputed';
  @ApiProperty({ required: false, nullable: true })
  acceptance_sent_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  acceptance_signed_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  acceptance_value!: number | null;
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Dispute reason (only populated when acceptance_status=disputed). Rendered read-only to the crew.',
  })
  acceptance_notes!: string | null;
  @ApiProperty({
    enum: ['pending', 'paid'],
    description: 'Payment status — flips to paid only after acceptance signed or admin force-pay.',
  })
  payment_status!: 'pending' | 'paid';
}
