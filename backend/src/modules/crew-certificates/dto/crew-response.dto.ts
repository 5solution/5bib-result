import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CrewNamedTemplateDto, CrewTemplateDto } from './crew-batch.dto';

/** 1 dòng roster (admin confirm). */
export class RecipientRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  position!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  extraFields?: Record<string, string>;
}

export class RosterConfirmDto {
  @ApiProperty({ type: [RecipientRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientRowDto)
  rows!: RecipientRowDto[];
}

/** Dòng roster lỗi (preview). */
export class InvalidRosterRowDto {
  @ApiProperty()
  rowNumber!: number;
  @ApiProperty()
  reason!: string;
}

export class RosterPreviewDto {
  @ApiProperty()
  total!: number;
  @ApiProperty({ type: [RecipientRowDto] })
  valid!: RecipientRowDto[];
  @ApiProperty({ type: [InvalidRosterRowDto] })
  invalid!: InvalidRosterRowDto[];
  @ApiProperty({ type: [String], description: 'Cột thông tin thêm phát hiện' })
  extraFields!: string[];
}

export class BatchResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  slug!: string;
  @ApiProperty()
  eventName!: string;
  @ApiProperty()
  active!: boolean;
  @ApiProperty({ type: [String] })
  extraFields!: string[];
  @ApiProperty()
  recipientCount!: number;
  @ApiPropertyOptional({ type: CrewTemplateDto, nullable: true })
  template?: CrewTemplateDto | null;
  @ApiProperty({ type: [CrewNamedTemplateDto], description: 'FEATURE-094 — phôi phụ theo vị trí' })
  templates!: CrewNamedTemplateDto[];
  @ApiProperty()
  createdAt!: string;
  @ApiProperty()
  updatedAt!: string;
}

export class BatchListItemDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  slug!: string;
  @ApiProperty()
  eventName!: string;
  @ApiProperty()
  active!: boolean;
  @ApiProperty()
  recipientCount!: number;
  @ApiProperty()
  updatedAt!: string;
}

export class BatchListResponseDto {
  @ApiProperty({ type: [BatchListItemDto] })
  items!: BatchListItemDto[];
  @ApiProperty()
  total!: number;
}

/** Public search result (BR-05 — KHÔNG leak field nhạy cảm). */
export class CrewSearchResultDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  fullName!: string;
  @ApiProperty()
  position!: string;
}
