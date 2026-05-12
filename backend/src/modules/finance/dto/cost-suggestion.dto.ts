import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { COST_CATEGORIES, CostCategory } from '../schemas/cost-item.schema';
import { CreateCostItemDto } from './create-cost-item.dto';

/**
 * F-028 Phase 3 — gợi ý chi phí từ HĐ.
 *
 * Endpoint `GET /finance/contracts/:id/cost-suggestions` đọc line items của
 * HĐ có `catalogItemId`, lookup `ServiceCatalog.referenceCost` → trả mảng
 * `CostSuggestionDto`. Admin tick các dòng muốn tạo, gửi `BulkCreateCostItemsDto`
 * lên `POST /finance/contracts/:id/cost-items/bulk` để insertMany atomic.
 *
 * KHÔNG bao gồm field `id` vì suggestion chưa lưu — chỉ là tham chiếu sống
 * của catalog × line item quantity. Admin xác nhận → tạo thành CostItem.
 *
 * Category mapping: `mapCategoryToCostCategory()` ở service. Default rule
 * (Phase 3 v1) đơn giản, đặt rõ comment để admin override sau khi tạo.
 */
export class CostSuggestionDto {
  @ApiProperty({
    description: 'ServiceCatalog._id reference của line item',
    example: '6655aa1234...',
  })
  catalogItemId!: string;

  @ApiProperty({
    description: 'Tên gợi ý (lấy từ ServiceCatalog.name)',
  })
  description!: string;

  @ApiProperty({ enum: COST_CATEGORIES })
  category!: CostCategory;

  @ApiProperty({ description: 'Số lượng từ line item' })
  quantity!: number;

  @ApiProperty({ required: false })
  unit?: string;

  @ApiProperty({ description: 'Giá vốn tham khảo / đơn vị (VND)' })
  costPerUnit!: number;

  @ApiProperty({
    description: 'quantity × costPerUnit (VND, include VAT — BR-PNL-02)',
  })
  suggestedAmount!: number;

  @ApiProperty({ description: 'STT line item trong HĐ (giúp admin trace)' })
  contractLineItemStt!: number;
}

/**
 * F-028 Phase 3 — bulk create cost items từ list suggestion admin đã tick.
 *
 * Payload là array `CreateCostItemDto` để re-use validation rules cũ
 * (description maxLength 500, amount min 0, category enum...).
 *
 * Idempotency: admin có thể tick 2 lần thì sẽ tạo 2N cost items. Frontend
 * dialog disable nút submit sau click đầu để tránh double submit. Server
 * KHÔNG dedupe vì admin có thể cố ý tạo nhiều entry cùng description.
 */
export class BulkCreateCostItemsDto {
  @ApiProperty({ type: [CreateCostItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCostItemDto)
  items!: CreateCostItemDto[];
}
