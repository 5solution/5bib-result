import { ApiProperty } from '@nestjs/swagger';

/**
 * F-019 v2 — AG Eligibility Report DTO.
 *
 * Pre-race readiness surface (Race Ops advisory v2 §4) — surface vào
 * Readiness tab existing (PAUSE-MGR-V2-03 LOCKED).
 *
 * Coverage threshold (advisory §2):
 *   ≥ 95% → READY
 *   80-94% → WARNING
 *   < 80% → NOT_READY
 */

export class BracketDistributionItemDto {
  @ApiProperty({ example: '30-39', description: 'Bracket key' })
  ageGroup!: string;

  @ApiProperty({ enum: ['M', 'F'], example: 'M' })
  gender!: 'M' | 'F';

  @ApiProperty({ example: 423, description: 'Số athletes trong bracket × gender' })
  count!: number;
}

export class VendorCategoryHealthDto {
  @ApiProperty({ example: 1245, description: 'Số athletes có vendor Category populated đúng format' })
  populated!: number;

  @ApiProperty({ example: 980, description: 'Số athletes có vendor Category empty/whitespace (Giải Công An bug)' })
  empty!: number;

  @ApiProperty({ example: 30, description: 'Số athletes có vendor Category sai format (regex fail)' })
  malformed!: number;
}

export class AGEligibilityReportDto {
  @ApiProperty({ example: '69f2ca611e1147680ebea4c6' })
  raceId!: string;

  @ApiProperty({ example: 3039, description: 'Tổng athletes registered cho race' })
  totalAthletes!: number;

  @ApiProperty({ example: 2580, description: 'Số athletes có ageOnRaceDay computed (DOB available)' })
  withDob!: number;

  @ApiProperty({ example: 459, description: 'Số athletes thiếu DOB (cần BTC nhập bù)' })
  withoutDob!: number;

  @ApiProperty({ example: 0.85, description: 'Coverage ratio (0..1) = withDob/totalAthletes' })
  coverage!: number;

  @ApiProperty({
    enum: ['READY', 'WARNING', 'NOT_READY'],
    example: 'WARNING',
    description: 'Threshold based on coverage: ≥95% READY / 80-94% WARNING / <80% NOT_READY',
  })
  readinessLevel!: 'READY' | 'WARNING' | 'NOT_READY';

  @ApiProperty({
    type: [String],
    example: ['1234', '5678', '9012'],
    description: 'Top 100 BIBs thiếu DOB (cho BTC drilldown export CSV)',
  })
  missingDobBibs!: string[];

  @ApiProperty({
    type: [BracketDistributionItemDto],
    description: 'Preview bracket distribution — help BTC chuẩn bị medal đúng số bracket',
  })
  bracketDistribution!: BracketDistributionItemDto[];

  @ApiProperty({
    type: VendorCategoryHealthDto,
    description: 'Vendor Category sanity check — flag BTC sửa config RaceResult trước race day',
  })
  vendorCategoryHealth!: VendorCategoryHealthDto;

  @ApiProperty({
    enum: ['5bib', 'vendor', 'hybrid'],
    example: '5bib',
    description: 'Current bracketSource override on race (default 5bib)',
  })
  bracketSource!: '5bib' | 'vendor' | 'hybrid';

  @ApiProperty({
    type: String,
    example: '2026-05-09T17:00:00.000Z',
    description: 'Last age-sync timestamp (cron T-1 EVERY_DAY_AT_MIDNIGHT or on-demand)',
  })
  lastSyncedAt?: string;
}
