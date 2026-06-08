import { ApiProperty } from '@nestjs/swagger';

/**
 * F-076 PRD 3.3 — row trong bảng "Đơn missing" của reconcile report.
 *
 * BR-05b mandate: render `orderCode` (= order_metadata.name, format `#5B<id>IB`)
 * trên UI/alert. `orderId` raw chỉ dùng cho mapping logic backend (BR-05 RefID
 * split, JOIN).
 *
 * BR-07 — bucket enum 4 values, classifier compute từ classify() pure function.
 */
export type ReconcileBucket = 'OK' | 'SYNC_LAG' | 'UNISSUED' | 'DUPLICATE';

export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export class MissingInvoiceRowDto {
  @ApiProperty({
    description: 'order_metadata.id (internal, dùng mapping)',
    example: 200029416,
  })
  orderId!: number;

  @ApiProperty({
    description:
      'order_metadata.name = public order code, render trên UI/alert (BR-05b)',
    example: '#5B200029416IB',
  })
  orderCode!: string;

  @ApiProperty({ description: 'race_id', example: 140 })
  raceId!: number;

  @ApiProperty({
    description: 'Email người mua',
    example: 'nghiemthuhien1221@gmail.com',
    required: false,
    nullable: true,
  })
  email?: string | null;

  @ApiProperty({
    description: 'Họ tên người mua (first_name + last_name fallback name)',
    example: 'Hiền Nghiêm',
    required: false,
    nullable: true,
  })
  buyerName?: string | null;

  @ApiProperty({ description: 'Tổng tiền VND', example: 12000 })
  totalPrice!: number;

  @ApiProperty({
    description: 'Thời gian paid (ISO 8601 UTC)',
    example: '2026-06-05T09:45:44.000Z',
  })
  paymentOn!: string;

  @ApiProperty({ description: 'order_category', example: 'ORDINARY' })
  orderCategory!: string;

  @ApiProperty({
    description: 'Tuổi đơn tính theo giờ ICT (now - payment_on)',
    example: 76,
  })
  ageHours!: number;

  @ApiProperty({
    enum: ['OK', 'SYNC_LAG', 'UNISSUED', 'DUPLICATE'],
    example: 'SYNC_LAG',
  })
  bucket!: ReconcileBucket;

  @ApiProperty({
    description: 'Severity tier — derived từ bucket + ageHours (BR-08)',
    enum: ['INFO', 'WARN', 'CRITICAL'],
    example: 'WARN',
  })
  severity!: AlertSeverity;

  @ApiProperty({
    description: 'Đơn age >= breached threshold (24h) — đã phạt',
    example: false,
  })
  breached!: boolean;

  @ApiProperty({
    description: 'MISA InvNo đã match (chỉ set khi SYNC_LAG)',
    example: '00000022',
    required: false,
    nullable: true,
  })
  misaInvNo?: string | null;

  @ApiProperty({
    description:
      'Số hóa đơn MISA gốc cùng orderId (chỉ set khi DUPLICATE, >= 2)',
    example: 5,
    required: false,
  })
  duplicateCount?: number;
}
