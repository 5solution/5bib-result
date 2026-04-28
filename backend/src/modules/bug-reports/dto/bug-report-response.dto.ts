import { ApiProperty } from '@nestjs/swagger';
import {
  BUG_CATEGORIES,
  BUG_SEVERITIES,
  BUG_STATUSES,
  BugCategory,
  BugSeverity,
  BugStatus,
} from '../schemas/bug-report.schema';

export class BugStatusHistoryDto {
  @ApiProperty({ enum: BUG_STATUSES, nullable: true })
  fromStatus!: BugStatus | null;

  @ApiProperty({ enum: BUG_STATUSES })
  toStatus!: BugStatus;

  @ApiProperty({ nullable: true })
  changedBy!: string | null;

  @ApiProperty({ nullable: true })
  changedByName!: string | null;

  @ApiProperty()
  changedAt!: Date;

  @ApiProperty({ nullable: true })
  reason!: string | null;
}

// Public submit response — minimal info, no PII or internal IDs.
export class CreateBugReportResponseDto {
  @ApiProperty({ example: 'BUG-20260428-0001' })
  publicId!: string;

  @ApiProperty({ example: 'received' })
  status!: 'received';

  @ApiProperty({
    example: '≤ 4 giờ',
    description: 'Estimated response time based on submitted severity',
  })
  estimatedResponseTime!: string;
}

// Admin list/detail item — includes admin-only fields (ipAddress, userAgent, statusHistory).
export class BugReportAdminDto {
  @ApiProperty() id!: string;
  @ApiProperty() publicId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() stepsToReproduce!: string;
  @ApiProperty({ enum: BUG_CATEGORIES }) category!: BugCategory;
  @ApiProperty({ enum: BUG_SEVERITIES }) severity!: BugSeverity;
  @ApiProperty({ enum: BUG_STATUSES }) status!: BugStatus;
  @ApiProperty() email!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty() wantsUpdates!: boolean;
  @ApiProperty() urlAffected!: string;
  @ApiProperty() userAgent!: string;
  @ApiProperty() viewport!: string;
  @ApiProperty() referrer!: string;
  @ApiProperty() ipAddress!: string;
  @ApiProperty({ nullable: true }) assigneeId!: string | null;
  @ApiProperty({ nullable: true }) assigneeName!: string | null;
  @ApiProperty({ nullable: true }) duplicateOfPublicId!: string | null;
  @ApiProperty({ type: [BugStatusHistoryDto] })
  statusHistory!: BugStatusHistoryDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty() isDeleted!: boolean;
}

export class PaginatedBugReportsAdminDto {
  @ApiProperty({ type: [BugReportAdminDto] }) items!: BugReportAdminDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class BugReportStatsDto {
  @ApiProperty() new!: number;
  @ApiProperty() triaged!: number;
  @ApiProperty() inProgress!: number;
  @ApiProperty() resolved!: number;
  @ApiProperty() critical!: number;
  @ApiProperty() total!: number;
}
