import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/* ─────────── Supply Item (Master SKU) ─────────── */

export class CreateSupplyItemDto {
  @ApiProperty({ example: 'WATER_500ML' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  sku: string;

  @ApiProperty({ example: 'Nước Lavie 500ml' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Chai 500ml' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'thùng' })
  @IsString()
  @MaxLength(50)
  unit: string;

  @ApiProperty({ example: 'nước' })
  @IsString()
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ example: 65000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  default_price?: number;
}

export class UpdateSupplyItemDto extends PartialType(CreateSupplyItemDto) {}

export class SupplyItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() event_id: string;
  @ApiProperty() sku: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() unit: string;
  @ApiProperty() category: string;
  @ApiPropertyOptional() default_price?: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class SupplyItemListResponseDto {
  @ApiProperty({ type: [SupplyItemResponseDto] }) items: SupplyItemResponseDto[];
  @ApiProperty() total: number;
}

/* ─────────── Supply Order ─────────── */

export class SupplyOrderLineDto {
  @ApiProperty({ example: 'WATER_500ML' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Giao trước 3h sáng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateSupplyOrderDto {
  @ApiProperty({ description: 'Team tạo order', example: '65f...' })
  @IsMongoId()
  team_id: string;

  @ApiProperty({ type: [SupplyOrderLineDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SupplyOrderLineDto)
  items: SupplyOrderLineDto[];
}

export class UpdateSupplyOrderItemsDto {
  @ApiProperty({ type: [SupplyOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SupplyOrderLineDto)
  items: SupplyOrderLineDto[];
}

export class RejectSupplyOrderDto {
  @ApiProperty({ example: 'Số lượng quá lớn, cần xem xét lại' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason: string;
}

export class SupplyOrderQueryDto {
  @ApiPropertyOptional({
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  team_id?: string;
}

export class SupplyOrderItemResponseDto {
  @ApiProperty() sku: string;
  @ApiProperty() name: string;
  @ApiProperty() unit: string;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional() note?: string;
}

export class SupplyOrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() event_id: string;
  @ApiProperty() team_id: string;
  @ApiProperty() order_code: string;
  @ApiProperty() created_by: string;
  @ApiProperty({ type: [SupplyOrderItemResponseDto] }) items: SupplyOrderItemResponseDto[];
  @ApiProperty({
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED'],
  })
  status: string;
  @ApiPropertyOptional() submitted_at?: Date;
  @ApiPropertyOptional() approved_at?: Date;
  @ApiProperty({ nullable: true, type: String }) approved_by: string | null;
  @ApiPropertyOptional() rejected_reason?: string;
  @ApiPropertyOptional() dispatched_at?: Date;
  @ApiProperty({ nullable: true, type: String }) dispatched_by: string | null;
  @ApiPropertyOptional() received_at?: Date;
  @ApiProperty({ nullable: true, type: String }) received_by: string | null;
  @ApiProperty({ type: [String] }) received_proof_urls: string[];
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class SupplyOrderListResponseDto {
  @ApiProperty({ type: [SupplyOrderResponseDto] }) items: SupplyOrderResponseDto[];
  @ApiProperty() total: number;
}

/* ─────────── Aggregate ─────────── */

export class SupplyAggregateLineDto {
  @ApiProperty() sku: string;
  @ApiProperty() name: string;
  @ApiProperty() unit: string;
  @ApiProperty() category: string;
  @ApiProperty({ description: 'Tổng quantity từ APPROVED+ orders' })
  total_approved: number;
  @ApiProperty({ description: 'Tổng quantity từ SUBMITTED (chờ duyệt)' })
  total_pending: number;
}

export class SupplyAggregateResponseDto {
  @ApiProperty() event_id: string;
  @ApiProperty({ type: [SupplyAggregateLineDto] })
  lines: SupplyAggregateLineDto[];
}
