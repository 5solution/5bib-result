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

  // v1.8: Team (category) mà role thuộc về. Optional — null = floater role
  // (không thuộc team operational nào, VD "Cố vấn", "Khách mời").
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'v1.8 Team/Category ID. NULL = floater (không thuộc team nào). Để phân nhóm Leader/Crew/TNV thành 1 team shared stations + supply.',
  })
  @IsOptional()
  @IsInt()
  category_id?: number | null;

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

  // v1.6 Option B2: nested N:M. Leader role quản lý nhiều role thông qua
  // junction table vol_role_manages. BFS resolver trong TeamRoleHierarchyService
  // tự động include descendants (tối đa 5 tầng). Empty/undefined cho non-leader.
  @ApiProperty({
    required: false,
    type: [Number],
    description:
      'v1.6 Option B2: nested. Leader role quản lý nhiều role (multi-select). BFS resolver tự động include descendants.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  manages_role_ids?: number[];

  // v1.4/v1.6 companion — already on entity but was not DTO-exposed. Include
  // so admin can toggle "is leader role" + optionally wire manages_role_ids.
  @ApiProperty({
    required: false,
    default: false,
    description:
      'True = leader role (portal access + station gating). Companion field for manages_role_ids.',
  })
  @IsOptional()
  @IsBoolean()
  is_leader_role?: boolean;
}
