import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FontOptionDto {
  @ApiProperty({ example: 'Montserrat' })
  family!: string;

  @ApiProperty({ example: 'Montserrat' })
  label!: string;

  @ApiProperty({ example: 'sans', enum: ['sans', 'serif', 'display', 'script'] })
  category!: string;
}

class StaticFieldsView {
  @ApiProperty() location!: string;
  @ApiProperty() raceDay!: string;
  @ApiProperty() distance!: string;
  @ApiProperty() passportPrefix!: string;
}

class EmailView {
  @ApiProperty() subject!: string;
  @ApiProperty() bodyHtml!: string;
  @ApiProperty() fromName!: string;
}

export class BibPassConfigResponseDto {
  @ApiProperty({ description: 'Mongo id của config' })
  id!: string;

  @ApiProperty({ example: 192 })
  raceId!: number;

  @ApiProperty({ example: 'Vietnam Mountain Marathon 2026' })
  raceName!: string;

  @ApiProperty({ example: false })
  enabled!: boolean;

  @ApiPropertyOptional({ type: Object, nullable: true, description: 'Phôi (canvas/layers/photoArea)' })
  template!: Record<string, unknown> | null;

  @ApiProperty({ type: StaticFieldsView })
  staticFields!: StaticFieldsView;

  @ApiProperty({ type: EmailView })
  email!: EmailView;

  @ApiProperty({ example: 'border-pass-{bib}.png' })
  attachmentFilename!: string;

  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class BibPassConfigListItemDto {
  @ApiProperty() raceId!: number;
  @ApiProperty() raceName!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ description: 'Đã cấu hình phôi chưa' }) hasTemplate!: boolean;
  @ApiProperty({ description: 'Số VĐV đã gửi (idempotency ledger)' }) sentCount!: number;
  @ApiProperty() updatedAt!: string;
}

export class BibPassConfigListResponseDto {
  @ApiProperty({ type: [BibPassConfigListItemDto] })
  items!: BibPassConfigListItemDto[];

  @ApiProperty() total!: number;
}

/** 1 giải có VĐV (dropdown chọn giải để cấu hình). */
export class BibPassRaceOptionDto {
  @ApiProperty({ example: 192 }) raceId!: number;
  @ApiProperty({ example: 'Vietnam Mountain Marathon 2026', nullable: true }) title!: string | null;
  @ApiProperty({ example: 1493, description: 'Số VĐV đã xác nhận BIB' }) confirmedCount!: number;
  @ApiProperty({ description: 'Đã có config chưa' }) configured!: boolean;
}

export class BibPassRaceOptionsResponseDto {
  @ApiProperty({ type: [BibPassRaceOptionDto] })
  items!: BibPassRaceOptionDto[];
}

/** 1 dòng VĐV đã xác nhận BIB (admin xem + trạng thái gửi). */
export class ConfirmedAthleteRowDto {
  @ApiProperty() athletesId!: number;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty({ nullable: true }) bib!: string | null;
  @ApiProperty({ description: 'Email đầy đủ (admin nội bộ)', nullable: true }) email!: string | null;
  @ApiProperty({ description: 'Đã có email không' }) hasEmail!: boolean;
  @ApiProperty({ enum: ['sent', 'failed', 'skipped', 'pending'], example: 'pending' })
  sendStatus!: string;
}

export class ConfirmedAthletesResponseDto {
  @ApiProperty({ type: [ConfirmedAthleteRowDto] })
  items!: ConfirmedAthleteRowDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class BibPassStatsDto {
  @ApiProperty({ description: 'Số VĐV đã xác nhận BIB (đủ điều kiện)' }) confirmed!: number;
  @ApiProperty({ description: 'Đã gửi thành công' }) sent!: number;
  @ApiProperty({ description: 'Gửi lỗi' }) failed!: number;
  @ApiProperty({ description: 'Bỏ qua (vd no_email / kill_switch)' }) skipped!: number;
  @ApiProperty({ description: 'Còn lại chưa xử lý' }) pending!: number;
}

export class SendBatchResultDto {
  @ApiProperty({ description: 'Số VĐV xử lý lần này' }) attempted!: number;
  @ApiProperty() sent!: number;
  @ApiProperty() failed!: number;
  @ApiProperty({ description: 'Bỏ qua (no_email / kill_switch / đã gửi)' }) skipped!: number;
  @ApiProperty({ description: 'true nếu kill-switch BIB_PASS_SEND_ENABLED=false (dry-run)' })
  dryRun!: boolean;
  @ApiProperty({ description: 'true nếu còn VĐV chưa xử lý (vượt batch limit)' })
  hasMore!: boolean;
}

export class TestSendResultDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ description: 'Thông điệp kết quả (VN)' }) message!: string;
}
