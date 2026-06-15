import { ApiProperty } from '@nestjs/swagger';
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
  @IsInt()
  @Min(1)
  raceId!: number;

  @ApiProperty({
    description: 'Danh sách athletes_id được chọn (1–50)',
    type: [Number],
    example: [101, 102],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  athleteIds!: number[];
}
