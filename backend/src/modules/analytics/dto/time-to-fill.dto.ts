import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * F-026 BR-ANALYTICS-14/15 — Time-to-Fill + Fill Rate per course.
 */
export class TimeToFillQueryDto {
  @ApiProperty({
    description: 'Period: 7d / 30d / quarter / year / custom',
    enum: ['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'],
  })
  @IsString()
  @IsIn(['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'])
  period!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() raceId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() courseId?: string;
}

export class TimeToFillCourseDto {
  @ApiProperty() courseId!: number;
  @ApiProperty() courseName!: string;
  @ApiProperty() raceId!: number;
  @ApiProperty() raceName!: string;
  @ApiProperty({ nullable: true, description: 'Open at ISO' })
  openAt!: string | null;
  @ApiProperty({ nullable: true, description: 'Filled 100% ISO' })
  filledAt!: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Số giờ từ open → fill 100%. NULL = chưa fill 100%.',
  })
  hoursToFill!: number | null;
  @ApiProperty({ description: 'Fill rate %' })
  fillRate!: number;
  @ApiProperty({
    description: 'Trạng thái: OPEN / FILLED / EXPIRED',
    enum: ['OPEN', 'FILLED', 'EXPIRED'],
  })
  status!: string;
  @ApiProperty() quota!: number;
  @ApiProperty() paid!: number;
}

export class TimeToFillResponseDto {
  @ApiProperty({ type: [TimeToFillCourseDto] })
  courses!: TimeToFillCourseDto[];

  @ApiProperty({
    nullable: true,
    description: 'Median time-to-fill (giờ) — chỉ tính course đã fill',
  })
  medianHoursToFill!: number | null;
}
