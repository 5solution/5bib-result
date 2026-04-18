import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
// keep imports sorted
import { FormFieldConfigDto } from './form-field-config.dto';

export const CHAT_PLATFORMS = ['zalo', 'telegram', 'whatsapp', 'other'] as const;
export type ChatPlatform = (typeof CHAT_PLATFORMS)[number];

export class CreateRoleDto {
  @ApiProperty() @IsString() role_name!: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) max_slots!: number;

  @ApiProperty({ default: true }) @IsBoolean() waitlist_enabled: boolean = true;

  @ApiProperty({
    default: false,
    description:
      'FALSE (default): public register = status=pending, admin must approve. TRUE: status=approved immediately + claims slot + emails QR.',
  })
  @IsBoolean()
  @IsOptional()
  auto_approve?: boolean = false;

  @ApiProperty({ default: 0, description: 'VND per day' })
  @IsInt()
  @Min(0)
  daily_rate: number = 0;

  @ApiProperty({ default: 1 }) @IsInt() @Min(1) working_days: number = 1;

  @ApiProperty({ type: [FormFieldConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldConfigDto)
  form_fields!: FormFieldConfigDto[];

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  contract_template_id?: number;

  @ApiProperty({ default: 0 }) @IsInt() sort_order: number = 0;

  // v1.5: per-role group chat link. Gated on the public endpoint by
  // registration.status ∈ (contract_signed, qr_sent, checked_in, completed).
  @ApiProperty({
    required: false,
    enum: CHAT_PLATFORMS,
    nullable: true,
    description: 'Group chat platform (zalo/telegram/whatsapp/other).',
  })
  @IsOptional()
  @IsEnum(CHAT_PLATFORMS)
  chat_platform?: ChatPlatform | null;

  // @IsString (not @IsUrl) — Zalo group links can be "zalo.me/g/xxx" without
  // protocol. Service sanitizes: prepends "https://" when protocol is missing,
  // and stores null for empty strings.
  @ApiProperty({
    required: false,
    nullable: true,
    maxLength: 500,
    description: 'Group chat URL (raw or protocol-less — service normalizes).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  chat_group_url?: string | null;
}
