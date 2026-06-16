import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

/** Tạo batch đơn thủ công (BR-IGL-12). */
export class CreateIglooRequestsDto {
  @ApiProperty({ description: 'mysql_race_id của giải', example: 220 })
  // Legacy BIGINT id có thể tới dạng string (TypeORM bigNumberStrings) → coerce.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  raceId!: number;

  @ApiProperty({
    description: 'Danh sách athletes_id được chọn (1–50)',
    type: [Number],
    example: [101, 102],
  })
  // athletes_id từ legacy là BIGINT → frontend có thể gửi string → coerce.
  @Type(() => Number)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  athleteIds!: number[];
}
