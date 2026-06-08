import { ApiProperty } from '@nestjs/swagger';

/** FEATURE-072 — one aggregate bucket (label + count). No PII. */
export class InsightBucketDto {
  @ApiProperty({ description: 'Nhãn nhóm (size/giới/AG/quốc gia/tỉnh)', example: 'M' })
  label!: string;

  @ApiProperty({ description: 'Số VĐV trong nhóm', example: 128 })
  count!: number;
}

/** FEATURE-072 — Participant Insights aggregate for one race (paid, no PII). */
export class ParticipantInsightsDto {
  @ApiProperty({ description: 'Race ID', example: 209 })
  raceId!: number;

  @ApiProperty({ description: 'Tổng số VĐV đã thanh toán', example: 439 })
  totalParticipants!: number;

  @ApiProperty({ type: [InsightBucketDto], description: 'Phân bổ size áo (canonical order)' })
  shirtSizes!: InsightBucketDto[];

  @ApiProperty({ type: [InsightBucketDto], description: 'Giới tính (Nam/Nữ/Khác)' })
  genders!: InsightBucketDto[];

  @ApiProperty({ type: [InsightBucketDto], description: 'Nhóm tuổi (World Athletics 5 năm)' })
  ageGroups!: InsightBucketDto[];

  @ApiProperty({ type: [InsightBucketDto], description: 'Quốc tịch (top 8 + Khác)' })
  nationalities!: InsightBucketDto[];

  @ApiProperty({ type: [InsightBucketDto], description: 'Tỉnh/thành (top 10 + Khác)' })
  provinces!: InsightBucketDto[];
}
