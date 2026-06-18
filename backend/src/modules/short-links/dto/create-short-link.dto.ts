import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** FEATURE-089 — body tạo short link (admin). */
export class CreateShortLinkDto {
  @ApiProperty({
    description: 'URL đích (http/https)',
    maxLength: 2048,
    example: 'https://5bib.com/vi/events/lao-cai-marathon-2026-dong-chay-bien-cuong',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, {
    message: 'URL phải bắt đầu http:// hoặc https://',
  })
  targetUrl!: string;

  @ApiPropertyOptional({ description: 'Tiêu đề', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Alias tùy chỉnh (3–32 ký tự [A-Za-z0-9_-]). Để trống = tự sinh.',
    example: 'laocai2026',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, {
    message: 'Alias chỉ gồm chữ/số/_/- (3–32 ký tự)',
  })
  customAlias?: string;
}
