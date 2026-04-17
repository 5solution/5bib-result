import { ApiProperty } from '@nestjs/swagger';
import type {
  ContractStatus,
  PaymentStatus,
  RegistrationStatus,
  ShirtSize,
} from '../entities/vol-registration.entity';

/**
 * Full personnel view for a single registration (admin). CCCD photo URL
 * here is a short-lived presigned URL (1h). CCCD number in form_data is
 * NOT masked here — admins need the real value for reporting.
 */
export class RegistrationDetailDto {
  @ApiProperty() id!: number;
  @ApiProperty() role_id!: number;
  @ApiProperty() role_name!: string;
  @ApiProperty() event_id!: number;
  @ApiProperty() event_name!: string;

  @ApiProperty() full_name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;

  @ApiProperty({ required: false, nullable: true })
  shirt_size!: ShirtSize | null;

  @ApiProperty({ required: false, nullable: true })
  avatar_photo_url!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'S3 presigned URL for CCCD photo, expires in 1 hour',
  })
  cccd_photo_url!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Form answers. CCCD number NOT masked for admin detail view.',
  })
  form_data!: Record<string, unknown>;

  @ApiProperty() status!: RegistrationStatus;
  @ApiProperty({ required: false, nullable: true })
  waitlist_position!: number | null;

  @ApiProperty({ required: false, nullable: true })
  checked_in_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  checkin_method!: string | null;

  @ApiProperty() contract_status!: ContractStatus;
  @ApiProperty({ required: false, nullable: true })
  contract_signed_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  contract_pdf_url!: string | null;

  @ApiProperty({ required: false, nullable: true })
  actual_working_days!: number | null;
  @ApiProperty({ required: false, nullable: true })
  actual_compensation!: string | null;
  @ApiProperty() payment_status!: PaymentStatus;

  @ApiProperty({ required: false, nullable: true })
  notes!: string | null;
  @ApiProperty() created_at!: string;
}
