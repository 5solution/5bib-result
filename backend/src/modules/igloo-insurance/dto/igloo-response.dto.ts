import { ApiProperty } from '@nestjs/swagger';
import { IGLOO_SOURCES, IGLOO_STATUSES } from '../igloo-insurance.constants';

/** Trạng thái 2 kill-switch — hiển thị banner admin (BR-IGL-03). */
export class IglooConfigDto {
  @ApiProperty({ description: 'Cron tự động bật?' })
  dailyEnabled!: boolean;

  @ApiProperty({ description: 'Cho phép gửi đơn sang Igloo?' })
  submitEnabled!: boolean;

  @ApiProperty({ description: 'Số đơn tự động mỗi ngày' })
  dailyCount!: number;
}

/** Giải sắp diễn ra cho dropdown (BR-IGL eligible source). */
export class IglooRaceDto {
  @ApiProperty({ example: 220 })
  mysqlRaceId!: number;

  @ApiProperty({ nullable: true, example: 'LÀO CAI MARATHON 2026' })
  title!: string | null;

  @ApiProperty({ nullable: true, example: '2026-07-10T00:00:00.000Z' })
  eventStartDate!: string | null;

  @ApiProperty({ nullable: true })
  eventEndDate!: string | null;

  @ApiProperty({ nullable: true, example: 'TRAIL_RACE' })
  raceType!: string | null;
}

/** VĐV đủ điều kiện (Danny chốt KHÔNG mask PII). */
export class EligibleAthleteDto {
  @ApiProperty({ example: 101 })
  athletesId!: number;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName!: string;

  @ApiProperty({ nullable: true, example: '1234' })
  bib!: string | null;

  @ApiProperty({ enum: ['Nam', 'Nữ'], example: 'Nam' })
  gender!: string;

  @ApiProperty({ nullable: true, example: '1992-06-27' })
  dateOfBirth!: string | null;

  @ApiProperty({ description: 'CCCD đầy đủ (không mask)', example: '092124584349' })
  idCard!: string;

  @ApiProperty({ example: '0901234567' })
  phone!: string;

  @ApiProperty({ example: 'a@example.com' })
  email!: string;

  @ApiProperty({ description: 'Đã có đơn cho giải này chưa?' })
  hasOrder!: boolean;
}

/** Kết quả tạo batch. */
export class CreateIglooRequestsResultDto {
  @ApiProperty({ description: 'Số đơn tạo mới (QUEUED)' })
  created!: number;

  @ApiProperty({
    description: 'Bị bỏ qua + lý do',
    type: [Object],
    example: [{ athletesId: 102, reason: 'ALREADY_HAS_ORDER' }],
  })
  skipped!: Array<{
    athletesId: number;
    reason: 'ALREADY_HAS_ORDER' | 'NOT_ELIGIBLE';
  }>;

  @ApiProperty({ description: 'Tổng phí dự kiến (VNĐ)' })
  totalPremium!: number;
}

/** 1 đơn (KHÔNG leak _id raw / partnerRefId). */
export class IglooRequestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ enum: IGLOO_STATUSES })
  status!: string;

  @ApiProperty({ enum: ['ROAD', 'TRAIL'] })
  packageCode!: string;

  @ApiProperty()
  insuredName!: string;

  @ApiProperty({ description: 'CCCD đầy đủ' })
  insuredIdCard!: string;

  @ApiProperty({ nullable: true })
  bib!: string | null;

  @ApiProperty({ nullable: true })
  raceTitle!: string | null;

  @ApiProperty()
  mysqlRaceId!: number;

  @ApiProperty()
  totalPayment!: number;

  @ApiProperty({ enum: IGLOO_SOURCES })
  source!: string;

  @ApiProperty({ nullable: true })
  gicContractNo!: string | null;

  @ApiProperty({ nullable: true })
  certificateUrl!: string | null;

  @ApiProperty({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  retryCount!: number;

  @ApiProperty()
  createdAt!: string;
}

export class IglooRequestListDto {
  @ApiProperty({ type: [IglooRequestDto] })
  items!: IglooRequestDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class EligibleAthleteListDto {
  @ApiProperty({ type: [EligibleAthleteDto] })
  items!: EligibleAthleteDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
