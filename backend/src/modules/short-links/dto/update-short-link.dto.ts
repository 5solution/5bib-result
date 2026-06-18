import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** FEATURE-089 — body sửa short link (admin). Code KHÔNG đổi được sau khi tạo. */
export class UpdateShortLinkDto {
  @ApiPropertyOptional({ description: 'URL đích (http/https)', maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, {
    message: 'URL phải bắt đầu http:// hoặc https://',
  })
  targetUrl?: string;

  @ApiPropertyOptional({ description: 'Tiêu đề', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Bật/tắt link' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
