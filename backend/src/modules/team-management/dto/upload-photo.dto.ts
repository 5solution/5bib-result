import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export const PHOTO_TYPES = ['avatar', 'cccd'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export class UploadPhotoDto {
  @ApiProperty({ enum: PHOTO_TYPES })
  @IsEnum(PHOTO_TYPES)
  photo_type!: PhotoType;
}

export class UploadPhotoResponseDto {
  @ApiProperty() url!: string;
}
