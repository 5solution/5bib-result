import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class TicketStatusCountDto {
  @ApiProperty({
    description:
      'Raw financial_status (paid/voided/pending) — frontend maps qua ORDER_FINANCIAL_STATUS dict',
    example: 'paid',
  })
  financialStatus: string;

  @ApiProperty({ description: 'Số đơn (COUNT DISTINCT order)', example: 1234 })
  orderCount: number;

  @ApiProperty({ description: 'Số vé (SUM line item quantity)', example: 1890 })
  ticketCount: number;
}

export class TicketSalesSummaryDto {
  @ApiProperty({ description: 'MySQL race_id đã filter', example: 501 })
  raceId: number;

  @ApiProperty({
    description: 'Tổng vé tất cả trạng thái (SUM quantity all status)',
    example: 2456,
  })
  totalTickets: number;

  @ApiProperty({
    description: 'Tổng đơn tất cả trạng thái',
    example: 1789,
  })
  totalOrders: number;

  @ApiProperty({
    description:
      'Breakdown theo financial_status. LUÔN gồm paid/voided/pending (0 nếu vắng) — frontend render 3 KPI cards. Status lạ (nếu có) append cuối.',
    type: [TicketStatusCountDto],
  })
  byStatus: TicketStatusCountDto[];
}

export class TicketBreakdownItemDto {
  @ApiProperty({ description: 'ID (courseId hoặc ticketTypeId)', example: 459 })
  id: number;

  @ApiProperty({
    description: 'Tên hiển thị (rc.name distance label hoặc tt.type_name)',
    example: '21KM',
  })
  name: string;

  @ApiProperty({ description: 'Số đơn paid (COUNT DISTINCT order)', example: 1023 })
  orderCount: number;

  @ApiProperty({ description: 'Số vé paid (SUM quantity)', example: 1466 })
  ticketCount: number;
}

export class TicketSalesBreakdownDto {
  @ApiProperty({ description: 'MySQL race_id đã filter', example: 501 })
  raceId: number;

  @ApiProperty({
    description: 'Tổng vé paid (base để frontend tính %)',
    example: 1466,
  })
  totalTickets: number;

  @ApiProperty({
    description: 'Items sorted ticketCount DESC',
    type: [TicketBreakdownItemDto],
  })
  items: TicketBreakdownItemDto[];
}

export type TicketChartGranularity = 'daily' | 'weekly' | 'monthly';

export class TicketSalesQueryDto {
  @ApiProperty({ description: 'MySQL race_id (bắt buộc)', example: 501 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId: number;
}
