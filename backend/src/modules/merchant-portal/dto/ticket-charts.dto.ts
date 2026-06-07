import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const PERIOD_VALUES = ['7d', '30d', '90d', 'quarter', 'year'] as const;
const GRANULARITY_VALUES = ['daily', 'weekly', 'monthly'] as const;

export class TicketChartQueryDto {
  @ApiProperty({ description: 'MySQL race_id', example: 138 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId: number;

  @ApiPropertyOptional({ enum: PERIOD_VALUES, default: '30d' })
  @IsIn([...PERIOD_VALUES], { message: 'period không hợp lệ' })
  @IsOptional()
  period?: (typeof PERIOD_VALUES)[number] = '30d';

  @ApiPropertyOptional({ enum: GRANULARITY_VALUES, default: 'daily' })
  @IsIn([...GRANULARITY_VALUES], { message: 'granularity không hợp lệ' })
  @IsOptional()
  granularity?: (typeof GRANULARITY_VALUES)[number] = 'daily';
}

export class TicketTrendPointDto {
  @ApiProperty({ description: 'Bucket key (YYYY-MM-DD / YYYY-Www / YYYY-MM)', example: '2026-03-01' })
  bucket: string;

  @ApiProperty({ description: 'VN display label', example: '01/03' })
  label: string;

  @ApiProperty({ description: 'Số đơn paid trong bucket', example: 42 })
  orderCount: number;
}

export class TicketTrendDto {
  @ApiProperty({ example: 138 })
  raceId: number;

  @ApiProperty({ enum: PERIOD_VALUES, example: '30d' })
  period: string;

  @ApiProperty({ enum: GRANULARITY_VALUES, example: 'daily' })
  granularity: string;

  @ApiProperty({ type: [TicketTrendPointDto] })
  series: TicketTrendPointDto[];
}

export class StackedCourseDto {
  @ApiProperty({ example: 459 })
  courseId: number;

  @ApiProperty({ example: '21KM' })
  courseName: string;
}

export class StackedSeriesPointDto {
  @ApiProperty({ description: 'Bucket key', example: '2026-03-01' })
  bucket: string;

  @ApiProperty({ description: 'VN display label', example: '01/03' })
  label: string;

  @ApiProperty({
    description: 'courseId → ticket count (SUM quantity paid). Missing course = 0.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '459': 120, '460': 80 },
  })
  counts: Record<number, number>;
}

export class TicketStackedDto {
  @ApiProperty({ example: 138 })
  raceId: number;

  @ApiProperty({ enum: PERIOD_VALUES, example: '30d' })
  period: string;

  @ApiProperty({ enum: GRANULARITY_VALUES, example: 'daily' })
  granularity: string;

  @ApiProperty({ type: [StackedCourseDto], description: 'Stable display order (total ticket DESC)' })
  courses: StackedCourseDto[];

  @ApiProperty({ type: [StackedSeriesPointDto] })
  series: StackedSeriesPointDto[];
}

export class TicketOrdersQueryDto {
  @ApiProperty({ description: 'MySQL race_id', example: 138 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Filter financial_status', enum: ['paid', 'voided', 'pending'] })
  @IsIn(['paid', 'voided', 'pending'])
  @IsOptional()
  financialStatus?: string;

  @ApiPropertyOptional({ description: 'Tìm theo tên người mua (LIKE first_name/last_name/name)', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}

export class TicketOrderRowDto {
  @ApiProperty({ description: 'MySQL order_metadata.id', example: 12358181 })
  orderId: number;

  @ApiProperty({ description: 'Tên người mua (first_name + last_name hoặc name)', example: 'Nguyễn Văn A' })
  buyerName: string;

  @ApiProperty({ description: 'Email người mua (BTC ops contact)', nullable: true, example: 'a@gmail.com' })
  buyerEmail: string | null;

  @ApiProperty({ description: 'SĐT người mua (BTC ops contact)', nullable: true, example: '0901234567' })
  buyerPhone: string | null;

  @ApiProperty({ description: 'Cự ly (rc.name)', nullable: true, example: '21KM' })
  courseName: string | null;

  @ApiProperty({ description: 'Loại vé (tt.type_name)', nullable: true, example: 'Standard 21K' })
  ticketTypeName: string | null;

  @ApiProperty({ description: 'Số vé (SUM oli.quantity)', example: 2 })
  quantity: number;

  @ApiProperty({ description: 'Raw financial_status — frontend maps VN', example: 'paid' })
  financialStatus: string;

  @ApiProperty({ description: 'Ngày thanh toán', nullable: true })
  paymentOn: Date | null;
}

export class TicketOrderListDto {
  @ApiProperty({ type: [TicketOrderRowDto] })
  items: TicketOrderRowDto[];

  @ApiProperty({ example: 1234 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
