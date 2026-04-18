import { ApiProperty } from '@nestjs/swagger';
import { CONTACT_TYPES, type ContactType } from './create-event-contact.dto';

// v1.5: Response DTO for a single emergency contact row.
export class EventContactDto {
  @ApiProperty() id!: number;
  @ApiProperty() event_id!: number;
  @ApiProperty({ enum: CONTACT_TYPES }) contact_type!: ContactType;
  @ApiProperty() contact_name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ required: false, nullable: true }) phone2!: string | null;
  @ApiProperty({ required: false, nullable: true }) note!: string | null;
  @ApiProperty() sort_order!: number;
  @ApiProperty() is_active!: boolean;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
}

// Grouped shape returned by the public endpoint. Keys are fixed so the
// frontend doesn't need to probe — empty arrays are fine.
export class EventContactsGroupDto {
  @ApiProperty({ type: [EventContactDto] }) medical!: EventContactDto[];
  @ApiProperty({ type: [EventContactDto] }) rescue!: EventContactDto[];
  @ApiProperty({ type: [EventContactDto] }) police!: EventContactDto[];
  @ApiProperty({ type: [EventContactDto] }) btc!: EventContactDto[];
  @ApiProperty({ type: [EventContactDto] }) other!: EventContactDto[];
}

export class PublicEventContactsResponseDto {
  @ApiProperty({ type: EventContactsGroupDto })
  contacts!: EventContactsGroupDto;
}
