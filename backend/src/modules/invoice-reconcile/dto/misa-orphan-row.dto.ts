import { ApiProperty } from '@nestjs/swagger';

/**
 * F-076 — MISA orphan: hóa đơn MISA xuất thực tế nhưng KHÔNG match orderId
 * nào trong DB legacy (rare case, surface lên admin UI Section C để Finance
 * verify).
 *
 * Khả năng:
 *  - DEV test local push thẳng PROD (case Manager đã verify session — 4/5
 *    invoice của order 200029416)
 *  - RefID format lạ → BR-06 regex parse fail
 *  - Race chưa enable trong env nhưng MISA vẫn xuất
 */
export class MisaOrphanRowDto {
  @ApiProperty({
    description: 'MISA RefID raw',
    example: '200029999-20260608183000',
  })
  refId!: string;

  @ApiProperty({ description: 'MISA InvNo (8-digit zero-pad)', example: '00000050' })
  invNo!: string;

  @ApiProperty({
    description: 'MISA InvSeries (ký hiệu hóa đơn)',
    example: '1C26MBB',
    required: false,
    nullable: true,
  })
  invSeries?: string | null;

  @ApiProperty({
    description: 'MISA InvDate (ISO 8601 với +07:00)',
    example: '2026-06-08T00:00:00+07:00',
  })
  invDate!: string;

  @ApiProperty({ description: 'Tổng tiền VND', example: 12000 })
  totalAmount!: number;

  @ApiProperty({
    description: 'Buyer full name từ MISA',
    example: 'Hiền Nghiêm',
    required: false,
    nullable: true,
  })
  buyerFullName?: string | null;

  @ApiProperty({
    description: 'Item name dòng đầu',
    example: '5BIB x COROS 5KM Priority 2434',
    required: false,
    nullable: true,
  })
  itemName?: string | null;

  @ApiProperty({
    description: 'Item code dòng đầu',
    example: '5KMPriority',
    required: false,
    nullable: true,
  })
  itemCode?: string | null;
}
