import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

/** FEATURE-074 — query for YoY curve (current + comparison race). */
export class YoyCurveQueryDto {
  @ApiProperty({ description: 'MySQL race_id hiện tại', example: 501 })
  @Type(() => Number)
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId không hợp lệ' })
  @IsNotEmpty({ message: 'raceId bắt buộc' })
  raceId!: number;

  @ApiProperty({ description: 'race_id giải so sánh (mùa trước)', example: 320 })
  @Type(() => Number)
  @IsInt({ message: 'compareRaceId phải là số nguyên' })
  @Min(1, { message: 'compareRaceId không hợp lệ' })
  @IsNotEmpty({ message: 'compareRaceId bắt buộc' })
  compareRaceId!: number;
}

/** FEATURE-074 — a race the user may compare against (same tenant, earlier). */
export class YoyComparableItemDto {
  @ApiProperty() raceId!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) eventStartDate!: string | null;
}

/** FEATURE-074 — candidate list for the YoY dropdown. */
export class YoyComparableDto {
  @ApiProperty() raceId!: number;
  @ApiProperty({ type: [YoyComparableItemDto] }) candidates!: YoyComparableItemDto[];
}

export class YoyPointDto {
  @ApiProperty({ description: '0 = ngày đua, lớn hơn = sớm hơn' }) daysBefore!: number;
  @ApiProperty({ description: 'Lũy kế đăng ký đã thanh toán' }) cum!: number;
}

export class YoySeriesDto {
  @ApiProperty() raceId!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) eventStartDate!: string | null;
  @ApiProperty({ type: [YoyPointDto] }) points!: YoyPointDto[];
}

/** FEATURE-074 — overlay 2 races by days-before-race. */
export class YoyCurveDto {
  @ApiProperty() current!: YoySeriesDto;
  @ApiProperty() compare!: YoySeriesDto;
}
