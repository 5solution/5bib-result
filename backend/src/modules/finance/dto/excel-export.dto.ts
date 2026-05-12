import { ApiProperty } from '@nestjs/swagger';

/**
 * F-028 BR-PNL-15 + BR-PNL-16 — response sau khi render + upload Excel.
 * Single contract export → trả signed URL 15min (TTL khớp F-024 pattern).
 */
export class ExcelExportResponseDto {
  @ApiProperty({ example: 'finance-pnl-exports/admin-uuid/1715500000-65abc.xlsx' })
  s3Key!: string;

  @ApiProperty({
    example: 'https://s3.../...?X-Amz-Signature=...',
    description: 'Pre-signed URL valid 15 phút (BR-PNL-16)',
  })
  signedUrl!: string;

  @ApiProperty({
    example: '[5BIB] CONG TY TNHH XYZ - PnL - 15.05.2026.xlsx',
    description: 'Suggested download filename (Content-Disposition convention)',
  })
  filename!: string;

  @ApiProperty({ description: 'Bytes file rendered (sanity check)' })
  bytes!: number;
}
