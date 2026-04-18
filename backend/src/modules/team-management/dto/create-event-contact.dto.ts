import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// v1.5 THAY ĐỔI 3: Emergency contacts (BTC / Medical / Rescue / Police / Other).
export const CONTACT_TYPES = [
  'btc',
  'medical',
  'rescue',
  'police',
  'other',
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

// Permissive phone regex — same spec as THAY ĐỔI 3. Accepts VN + international
// styling (spaces, +, dashes, parens). Stored trimmed-of-whitespace by service.
const PHONE_REGEX = /^[0-9\s+\-()]{8,20}$/;
const PHONE_MESSAGE = 'Số điện thoại không hợp lệ';

export class CreateEventContactDto {
  @ApiProperty({ enum: CONTACT_TYPES })
  @IsEnum(CONTACT_TYPES)
  contact_type!: ContactType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  contact_name!: string;

  @ApiProperty({ example: '0912 345 678' })
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone2?: string | null;

  @ApiProperty({ required: false, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
