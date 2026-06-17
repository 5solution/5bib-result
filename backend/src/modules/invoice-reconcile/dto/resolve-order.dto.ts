import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Matches, Min } from 'class-validator';

/**
 * F-088 — body cho POST /resolve: admin đánh dấu / bỏ đánh dấu 1 đơn "đã xử lý".
 */
export class ResolveOrderDto {
  @ApiProperty({ description: 'order_metadata.id', example: 200029416 })
  @IsInt()
  @Min(1)
  orderId!: number;

  @ApiProperty({
    description: 'true = đánh dấu đã xử lý (ẩn), false = bỏ đánh dấu',
    example: true,
  })
  @IsBoolean()
  resolved!: boolean;

  @ApiPropertyOptional({
    description: 'Ngày báo cáo yyyy-MM-dd ICT (default hôm nay). Scope resolved set.',
    example: '2026-06-17',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date phải dạng yyyy-MM-dd' })
  date?: string;
}

/** F-088 — kết quả POST /resolve. */
export class ResolveOrderResultDto {
  @ApiProperty({ example: 200029416 })
  orderId!: number;

  @ApiProperty({ example: true })
  resolved!: boolean;
}

/** F-088 — kết quả POST /send-heartbeat. */
export class SendHeartbeatResultDto {
  @ApiProperty({
    description: 'Heartbeat Telegram đã gửi thành công?',
    example: true,
  })
  sent!: boolean;
}
