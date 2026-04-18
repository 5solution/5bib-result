import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// =============================================================
// v1.6 Supply DTOs — items, plan, allocation, supplement
// =============================================================

// ---- ITEMS ----

export class CreateSupplyItemDto {
  @ApiProperty({ description: 'Tên item — unique per event', example: 'Nước (ly)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  item_name!: string;

  @ApiProperty({ description: 'Đơn vị tính', example: 'ly' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @ApiProperty({ required: false, description: 'Thứ tự hiển thị', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  // Only passed by the admin path. Leader path uses their own role_id automatically.
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'NULL = admin tạo; set = leader tạo (Q7: phân quyền edit). Chỉ admin được gửi field này.',
  })
  @IsOptional()
  @IsInt()
  created_by_role_id?: number | null;
}

export class UpdateSupplyItemDto extends PartialType(CreateSupplyItemDto) {}

export class SupplyItemDto {
  @ApiProperty() id!: number;
  @ApiProperty() event_id!: number;
  @ApiProperty() item_name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty({ required: false, nullable: true })
  created_by_role_id!: number | null;
  @ApiProperty() sort_order!: number;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
}

// ---- PLAN ----

export class UpsertSupplyPlanRequestItemDto {
  @ApiProperty({ description: 'ID của vật tư' })
  @IsInt()
  item_id!: number;

  @ApiProperty({ description: 'Số lượng leader đặt hàng', minimum: 0 })
  @IsInt()
  @Min(0)
  requested_qty!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  request_note?: string | null;
}

export class UpsertSupplyPlanRequestDto {
  @ApiProperty({ type: [UpsertSupplyPlanRequestItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertSupplyPlanRequestItemDto)
  items!: UpsertSupplyPlanRequestItemDto[];
}

export class UpsertSupplyPlanFulfillItemDto {
  @ApiProperty() @IsInt() item_id!: number;

  @ApiProperty({ description: 'Số lượng admin đáp ứng', minimum: 0 })
  @IsInt()
  @Min(0)
  fulfilled_qty!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fulfill_note?: string | null;
}

export class UpsertSupplyPlanFulfillDto {
  @ApiProperty({ type: [UpsertSupplyPlanFulfillItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertSupplyPlanFulfillItemDto)
  items!: UpsertSupplyPlanFulfillItemDto[];
}

export class SupplyPlanRowDto {
  @ApiProperty({ required: false, nullable: true })
  plan_id!: number | null;
  @ApiProperty() item_id!: number;
  @ApiProperty() item_name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty() requested_qty!: number;
  @ApiProperty({ required: false, nullable: true })
  request_note!: string | null;
  @ApiProperty({ required: false, nullable: true })
  fulfilled_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  fulfill_note!: string | null;
  @ApiProperty({ required: false, nullable: true })
  gap_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  updated_at!: string | null;
}

// ---- EVENT SUPPLY OVERVIEW ----

export class SupplyOverviewCellDto {
  @ApiProperty() role_id!: number;
  @ApiProperty() requested_qty!: number;
  @ApiProperty({ required: false, nullable: true })
  fulfilled_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  gap_qty!: number | null;
  @ApiProperty({ description: 'SUM(allocated_qty) của tất cả stations trong role' })
  allocated_qty!: number;
  @ApiProperty({
    description: 'SUM(confirmed_qty) của tất cả stations trong role',
  })
  confirmed_qty!: number;
}

export class SupplyOverviewItemRowDto {
  @ApiProperty() item_id!: number;
  @ApiProperty() item_name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty({ type: [SupplyOverviewCellDto] })
  cells!: SupplyOverviewCellDto[];
}

export class SupplyOverviewRoleColumnDto {
  @ApiProperty() role_id!: number;
  @ApiProperty() role_name!: string;
}

export class EventSupplyOverviewDto {
  @ApiProperty({ type: [SupplyOverviewRoleColumnDto] })
  roles!: SupplyOverviewRoleColumnDto[];
  @ApiProperty({ type: [SupplyOverviewItemRowDto] })
  items!: SupplyOverviewItemRowDto[];
}

// ---- ALLOCATION ----

export class UpsertAllocationItemDto {
  @ApiProperty() @IsInt() item_id!: number;

  @ApiProperty({ description: 'Số lượng phân bổ xuống trạm', minimum: 0 })
  @IsInt()
  @Min(0)
  allocated_qty!: number;
}

export class UpsertAllocationDto {
  @ApiProperty({ type: [UpsertAllocationItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertAllocationItemDto)
  allocations!: UpsertAllocationItemDto[];

  @ApiProperty({
    required: false,
    description:
      'Optimistic concurrency check — latest allocation.updated_at seen by client. If server sees newer, returns 409.',
  })
  @IsOptional()
  @IsDateString()
  optimistic_updated_at?: string;
}

export class ConfirmedByDto {
  @ApiProperty({ required: false, nullable: true }) name!: string | null;
  @ApiProperty({ required: false, nullable: true }) phone!: string | null;
}

export class AllocationRowDto {
  @ApiProperty() id!: number;
  @ApiProperty() station_id!: number;
  @ApiProperty() item_id!: number;
  @ApiProperty() item_name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty() allocated_qty!: number;
  @ApiProperty({ required: false, nullable: true })
  confirmed_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  shortage_qty!: number | null;
  @ApiProperty() is_locked!: boolean;
  @ApiProperty({ required: false, nullable: true })
  confirmed_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  confirmation_note!: string | null;
  @ApiProperty({ type: ConfirmedByDto, required: false, nullable: true })
  confirmed_by!: ConfirmedByDto | null;
  @ApiProperty() updated_at!: string;
}

export class UnlockAllocationDto {
  @ApiProperty({
    description: 'Lý do unlock — required cho audit trail (BR-SUP-ADM)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  admin_note!: string;
}

// ---- CREW CONFIRM ----

export class ConfirmSupplyReceiptDto {
  @ApiProperty() @IsInt() item_id!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  confirmed_qty!: number;
}

export class ConfirmSupplyDto {
  @ApiProperty({ type: [ConfirmSupplyReceiptDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ConfirmSupplyReceiptDto)
  receipts!: ConfirmSupplyReceiptDto[];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

// ---- SUPPLEMENT ----

export class CreateSupplementDto {
  @ApiProperty({ description: 'allocation cha — đã là is_locked=true' })
  @IsInt()
  allocation_id!: number;

  @ApiProperty({ description: 'Số lượng bổ sung (> 0)', minimum: 1 })
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class ConfirmSupplementDto {
  @ApiProperty() @IsInt() supplement_id!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  confirmed_qty!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class SupplementRowDto {
  @ApiProperty() id!: number;
  @ApiProperty() allocation_id!: number;
  @ApiProperty() round_number!: number;
  @ApiProperty() qty!: number;
  @ApiProperty({ required: false, nullable: true })
  note!: string | null;
  @ApiProperty({ required: false, nullable: true })
  confirmed_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  shortage_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  confirmed_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  confirmed_by_name!: string | null;
  @ApiProperty({ required: false, nullable: true })
  confirmed_by_phone!: string | null;
  @ApiProperty({ required: false, nullable: true })
  confirmation_note!: string | null;
  @ApiProperty() created_at!: string;
}

// ---- LEADER SUPPLY VIEW (OQ-B) ----

export class LeaderStationAllocationDto {
  @ApiProperty() allocation_id!: number;
  @ApiProperty() station_id!: number;
  @ApiProperty() station_name!: string;
  @ApiProperty() allocated_qty!: number;
  @ApiProperty({ required: false, nullable: true })
  confirmed_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  shortage_qty!: number | null;
  @ApiProperty() is_locked!: boolean;
  @ApiProperty({ required: false, nullable: true })
  confirmed_at!: string | null;
  @ApiProperty({ required: false, nullable: true })
  confirmation_note!: string | null;
  @ApiProperty({ type: ConfirmedByDto, required: false, nullable: true })
  confirmed_by!: ConfirmedByDto | null;
  @ApiProperty({ type: [SupplementRowDto] })
  supplements!: SupplementRowDto[];
}

export class LeaderSupplyItemViewDto {
  @ApiProperty() item_id!: number;
  @ApiProperty() item_name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty() requested_qty!: number;
  @ApiProperty({ required: false, nullable: true })
  fulfilled_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  gap_qty!: number | null;
  @ApiProperty({ required: false, nullable: true })
  request_note!: string | null;
  @ApiProperty({ required: false, nullable: true })
  fulfill_note!: string | null;
  @ApiProperty({ type: [LeaderStationAllocationDto] })
  stations!: LeaderStationAllocationDto[];
}

export class LeaderSupplyViewDto {
  @ApiProperty() event_id!: number;
  @ApiProperty({
    description:
      'v1.6 Option B2: FIRST managed role id (for backward compat with clients that rendered a single-role header). Prefer `managed_role_ids` for multi.',
  })
  role_id!: number;
  @ApiProperty({
    description:
      'Display name of the FIRST managed role. For backward compat mirrors first element of managed_role_names.',
  })
  role_name!: string;
  @ApiProperty({
    type: [Number],
    description:
      'v1.6 Option B2: ALL managed role ids (BFS result, nested descendants included).',
  })
  managed_role_ids!: number[];
  @ApiProperty({
    type: [String],
    description:
      'v1.6 Option B2: display names of ALL managed roles (same order as managed_role_ids). Crew UI renders as chips / joined header.',
  })
  managed_role_names!: string[];
  @ApiProperty({ type: [LeaderSupplyItemViewDto] })
  items!: LeaderSupplyItemViewDto[];
}
