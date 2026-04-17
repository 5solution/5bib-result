import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type IncidentStatusType = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

/* ───────── Create ───────── */

export class CreateIncidentDto {
  @ApiPropertyOptional({
    description: 'Team liên quan (nullable — incident event-wide)',
  })
  @IsOptional()
  @IsMongoId()
  team_id?: string;

  @ApiPropertyOptional({ example: 'N05', description: 'Station id (text) nếu có' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  station_id?: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  priority: IncidentPriority;

  @ApiProperty({
    example: 'Thiếu nước tại CP N05, 3 TNV bị say nắng',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Tối đa 3 S3 URLs. Upload trước qua /upload rồi gửi URLs.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({}, { each: true })
  photo_urls?: string[];
}

/* ───────── Update ───────── */

export class AcknowledgeIncidentDto {
  @ApiPropertyOptional({
    description: 'Optional note khi acknowledge',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ResolveIncidentDto {
  @ApiProperty({
    example: 'Đã điều 5 thùng nước từ kho Trung Tâm, xử lý TNV đưa về y tế',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  resolution_note: string;
}

/* ───────── Query ───────── */

export class IncidentListQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] })
  @IsOptional()
  @IsIn(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])
  status?: IncidentStatusType;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  priority?: IncidentPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  team_id?: string;
}

/* ───────── Response ───────── */

export class IncidentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() event_id: string;
  @ApiProperty() reported_by: string;
  @ApiProperty({ nullable: true, type: String }) team_id: string | null;
  @ApiPropertyOptional() station_id?: string;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] }) priority: IncidentPriority;
  @ApiProperty() description: string;
  @ApiProperty({ type: [String] }) photo_urls: string[];
  @ApiProperty({ enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] })
  status: IncidentStatusType;
  @ApiProperty({ nullable: true, type: String }) acknowledged_by: string | null;
  @ApiPropertyOptional() acknowledged_at?: Date;
  @ApiProperty({ nullable: true, type: String }) resolved_by: string | null;
  @ApiPropertyOptional() resolved_at?: Date;
  @ApiPropertyOptional() resolution_note?: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class IncidentListResponseDto {
  @ApiProperty({ type: [IncidentResponseDto] }) items: IncidentResponseDto[];
  @ApiProperty() total: number;
}
