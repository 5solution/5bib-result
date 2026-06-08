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

  @ApiProperty({
    description:
      'Số VĐV có dữ liệu chi tiết (vé qua 5BIB, có athlete_subinfo) — base cho các biểu đồ cơ cấu bên dưới',
    example: 432,
  })
  totalParticipants!: number;

  // ── F-IMPORT — tổng VĐV thật gồm cả vé import ──

  @ApiProperty({
    description:
      'Tổng VĐV THỰC = codes ACTIVE/SENT (gồm vé import). Cơ cấu (size/giới/AG/quốc tịch) chỉ tính trên `totalParticipants` vé có dữ liệu — vé import chưa có thông tin chi tiết.',
    example: 644,
  })
  totalIssued!: number;

  @ApiProperty({
    description: 'Số VĐV có dữ liệu cơ cấu (= totalParticipants, alias rõ nghĩa cho FE note)',
    example: 432,
  })
  participantsWithData!: number;

  @ApiProperty({
    description: 'Số vé import chưa có dữ liệu cơ cấu chi tiết',
    example: 212,
  })
  issuedImport!: number;

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
