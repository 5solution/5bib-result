import { IsArray, IsString, IsInt, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SlotOrderItemDto {
  @ApiProperty() @IsString() slotId: string;
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) display_order: number;
}

export class ReorderSlotsDto {
  @ApiProperty({ type: [SlotOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotOrderItemDto)
  slots: SlotOrderItemDto[];
}

export class ItemOrderEntryDto {
  @ApiProperty() @IsString() itemId: string;
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) item_order: number;
}

export class ReorderItemsDto {
  @ApiProperty({ type: [ItemOrderEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrderEntryDto)
  items: ItemOrderEntryDto[];
}
