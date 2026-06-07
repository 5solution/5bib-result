import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MERCHANT_PORTAL_PERMISSION_VALUES,
  type MerchantPortalPermission,
} from '../schemas/merchant-portal-access.schema';

export class RaceOverridesDto {
  @ApiPropertyOptional({
    description: 'Race IDs include thêm ngoài tenant scope (agency cross-tenant)',
    type: [Number],
    example: [501, 502],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayUnique()
  @IsOptional()
  include?: number[];

  @ApiPropertyOptional({
    description: 'Race IDs exclude khỏi tenant scope (loại bỏ giải cũ)',
    type: [Number],
    example: [301, 302],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayUnique()
  @IsOptional()
  exclude?: number[];
}

export class CreateAccessConfigDto {
  @ApiPropertyOptional({
    description:
      'Logto user ID (BR-MP-04). OPTIONAL — nếu bỏ trống, hệ thống tra theo email; ' +
      'chưa có account → tự tạo user Logto + assign role + gửi email mời (M3b auto-provision).',
    minLength: 3,
    maxLength: 128,
    example: 'logto_4a9f2b71c0',
  })
  @IsString()
  @MinLength(3, { message: 'Logto User ID quá ngắn (tối thiểu 3 ký tự)' })
  @MaxLength(128)
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'Tên hiển thị (denormalized từ Logto)',
    minLength: 1,
    maxLength: 255,
    example: 'Nguyễn Văn A',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên người dùng' })
  @MaxLength(255)
  userName: string;

  @ApiProperty({
    description: 'Email (denormalized từ Logto)',
    example: 'a@btc.vn',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({
    description: 'MySQL tenant IDs (BTC). Cross-tenant allowed for agency users.',
    type: [Number],
    example: [42, 99],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayUnique()
  @IsOptional()
  tenantIds?: number[];

  @ApiPropertyOptional({
    description: 'Per-race override (BR-MP-05 Option C)',
    type: RaceOverridesDto,
  })
  @ValidateNested()
  @Type(() => RaceOverridesDto)
  @IsOptional()
  raceOverrides?: RaceOverridesDto;

  @ApiProperty({
    description:
      'Permission level. Phải bao gồm `ticket_report`. Thêm `revenue_report` để cấp quyền finance.',
    enum: MERCHANT_PORTAL_PERMISSION_VALUES,
    isArray: true,
    example: ['ticket_report', 'revenue_report'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn mức quyền' })
  @IsEnum(MERCHANT_PORTAL_PERMISSION_VALUES, { each: true })
  @ArrayUnique()
  permissions: MerchantPortalPermission[];

  @ApiPropertyOptional({
    description: 'Trạng thái active. Default true.',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAccessConfigDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  userName?: string;

  @ApiPropertyOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayUnique()
  @IsOptional()
  tenantIds?: number[];

  @ApiPropertyOptional({ type: RaceOverridesDto })
  @ValidateNested()
  @Type(() => RaceOverridesDto)
  @IsOptional()
  raceOverrides?: RaceOverridesDto;

  @ApiPropertyOptional({
    enum: MERCHANT_PORTAL_PERMISSION_VALUES,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(MERCHANT_PORTAL_PERMISSION_VALUES, { each: true })
  @ArrayUnique()
  @IsOptional()
  permissions?: MerchantPortalPermission[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AccessConfigResponseDto {
  @ApiProperty({ description: 'MongoDB _id alias (BR-MP-23 strip pattern)' })
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: [Number] })
  tenantIds: number[];

  @ApiProperty({ type: RaceOverridesDto })
  raceOverrides: {
    include: number[];
    exclude: number[];
  };

  @ApiProperty({
    enum: MERCHANT_PORTAL_PERMISSION_VALUES,
    isArray: true,
  })
  permissions: MerchantPortalPermission[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdBy: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'true nếu user Logto vừa được tự tạo (M3b auto-provision)',
  })
  provisioned?: boolean;

  @ApiPropertyOptional({
    description:
      'true nếu email mời đã gửi thành công. false = chưa cấu hình email / gửi lỗi (user vẫn tạo, admin báo BTC thủ công).',
  })
  inviteEmailSent?: boolean;
}

export class AccessConfigListItemDto extends AccessConfigResponseDto {
  @ApiProperty({
    description:
      'Computed race count. Number = resolved races count; `"__all"` = all races của tenants (no overrides limit).',
    example: 3,
  })
  raceCount: number | '__all';

  @ApiProperty({ type: [String] })
  tenantNames: string[];
}

export class AccessConfigListResponseDto {
  @ApiProperty({ type: [AccessConfigListItemDto] })
  items: AccessConfigListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class AccessConfigListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by userName or email (case-insensitive)' })
  @IsString()
  @MaxLength(254)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by single tenantId' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tenantId?: number;

  @ApiPropertyOptional({
    enum: ['ticket_only', 'ticket_and_revenue'],
    description: 'Filter by permission tier',
  })
  @IsEnum(['ticket_only', 'ticket_and_revenue'])
  @IsOptional()
  permissionFilter?: 'ticket_only' | 'ticket_and_revenue';

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsEnum(['active', 'inactive'])
  @IsOptional()
  statusFilter?: 'active' | 'inactive';
}

export class DeleteAccessConfigResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  deletedUserId: string;
}
