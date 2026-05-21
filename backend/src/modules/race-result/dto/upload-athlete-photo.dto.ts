/**
 * FEATURE-047 Phase 1B — Athlete photo upload DTO + admin moderation DTOs.
 *
 * BR-47-11/12/14 — POST upload (multipart) + PATCH approve/reject (admin).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadAthletePhotoDto {
  @ApiProperty({ enum: ['selfie', 'bib_photo', 'finish_line'] })
  @IsEnum(['selfie', 'bib_photo', 'finish_line'], {
    message: 'Loại ảnh phải là selfie / bib_photo / finish_line',
  })
  type!: 'selfie' | 'bib_photo' | 'finish_line';

  @ApiPropertyOptional({ description: 'Race ID tag (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  raceId?: string;

  @ApiPropertyOptional({ description: 'Bib tag (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  bib?: string;
}

export class PhotoModerationActionDto {
  @ApiPropertyOptional({
    description: 'Lý do từ chối (required khi reject)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason?: string;
}

export class ToggleProfileActiveDto {
  @ApiProperty({ description: 'true = public, false = privacy opt-out 404' })
  active!: boolean;
}

export class UploadPhotoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: 'pending' | 'approved' | 'rejected';
  @ApiProperty() createdAt!: string;
}

export class ModerationQueueItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() athleteSlug!: string;
  @ApiProperty() type!: 'selfie' | 'bib_photo' | 'finish_line';
  @ApiProperty() signedUrl!: string;
  @ApiProperty() mime!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() uploadedAt!: string;
  @ApiPropertyOptional() raceId?: string;
  @ApiPropertyOptional() bib?: string;
}
