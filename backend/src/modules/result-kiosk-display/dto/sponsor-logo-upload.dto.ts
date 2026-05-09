import { ApiProperty } from '@nestjs/swagger';

export class SponsorLogoUploadResponseDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() url!: string;
  @ApiProperty() key!: string;
}

/** Max upload size: 2MB per logo (BR-RK-DC sponsor banner). */
export const SPONSOR_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const SPONSOR_LOGO_S3_PREFIX = 'result-kiosk-sponsors';
export const ALLOWED_LOGO_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
