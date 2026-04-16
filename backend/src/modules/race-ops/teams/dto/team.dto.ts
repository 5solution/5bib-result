import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Team Nước' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'WATER',
    description: 'UPPER_SNAKE_CASE, unique per event. Dùng trong order_code.',
  })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,19}$/, {
    message: 'code phải là UPPER_SNAKE_CASE, 2-20 ký tự, bắt đầu bằng chữ cái',
  })
  code: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  target_crew?: number;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  target_tnv?: number;

  @ApiPropertyOptional({ type: [String], example: ['N00', 'N01'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  station_ids?: string[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: '#1d4ed8' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ type: [String], example: ['water', 'medical'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @ApiPropertyOptional({
    description:
      'Admin-only: manually lock/unlock team (thường tự động locked khi event→LIVE)',
  })
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}

export class AssignLeaderDto {
  @ApiProperty({
    description: 'User id của ops_leader cùng event. Truyền null để unassign.',
    example: '65f0a4b2c8d1e5f3a7b8c9d0',
    nullable: true,
  })
  @IsOptional()
  @IsMongoId()
  leader_user_id: string | null;
}

/** ───────────── Response DTOs ───────────── */

export class TeamResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() event_id: string;
  @ApiProperty() name: string;
  @ApiProperty() code: string;
  @ApiProperty({ nullable: true, type: String })
  leader_user_id: string | null;
  @ApiProperty() target_crew: number;
  @ApiProperty() target_tnv: number;
  @ApiProperty({ type: [String] }) station_ids: string[];
  @ApiProperty() order: number;
  @ApiPropertyOptional() color?: string;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() locked: boolean;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class TeamListResponseDto {
  @ApiProperty({ type: [TeamResponseDto] })
  items: TeamResponseDto[];

  @ApiProperty()
  total: number;
}
