import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

// `cccd_back` shares S3 prefix with `cccd` (same sensitivity, same lifecycle).
// Service-level upload uses identical permissions for both — only the entity
// column they're written to differs (cccd_photo_url vs cccd_back_photo_url).
export const PHOTO_TYPES = ['avatar', 'cccd', 'cccd_back', 'benefits'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

// For admin upload-on-behalf-of-TNV — narrower set (no `benefits`).
export const ADMIN_PHOTO_TYPES = ['avatar', 'cccd', 'cccd_back'] as const;
export type AdminPhotoType = (typeof ADMIN_PHOTO_TYPES)[number];

export class AdminUploadPhotoDto {
  @ApiProperty({ enum: ADMIN_PHOTO_TYPES, description: 'Which slot to fill on the registration' })
  @IsEnum(ADMIN_PHOTO_TYPES)
  photo_type!: AdminPhotoType;
}

export class UploadPhotoDto {
  @ApiProperty({ enum: PHOTO_TYPES })
  @IsEnum(PHOTO_TYPES)
  photo_type!: PhotoType;
}

export class UploadPhotoResponseDto {
  @ApiProperty() url!: string;
}
