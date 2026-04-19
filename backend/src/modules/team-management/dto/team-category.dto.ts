import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class CreateTeamCategoryDto {
  @ApiProperty({ example: 'Team Nước', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'team-nuoc',
    description:
      'URL-safe slug, unique per event. Nếu bỏ trống server sẽ auto-gen từ name.',
    required: false,
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;

  @ApiProperty({
    example: '#3B82F6',
    description: 'Hex color #RRGGBB cho UI color-dot',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color phải dạng #RRGGBB' })
  color?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class UpdateTeamCategoryDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false, maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color phải dạng #RRGGBB' })
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class TeamCategoryDto {
  @ApiProperty() id!: number;
  @ApiProperty() event_id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() color!: string;
  @ApiProperty() sort_order!: number;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() role_count!: number;
  @ApiProperty() station_count!: number;
  @ApiProperty() supply_plan_count!: number;
  @ApiProperty() created_at!: Date;
  @ApiProperty() updated_at!: Date;
}
