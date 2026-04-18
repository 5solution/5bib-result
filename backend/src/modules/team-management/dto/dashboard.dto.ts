import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { ShirtSizeEnum } from './shirt-stock.dto';

export class DashboardQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 100, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}

export class DashboardRoleBreakdownDto {
  @ApiProperty() role_id!: number;
  @ApiProperty() role_name!: string;
  @ApiProperty() headcount!: number;
  @ApiProperty() checked_in!: number;
  @ApiProperty() contract_signed!: number;
  @ApiProperty() paid!: number;
}

export class DashboardShirtSizeDto {
  @ApiProperty({ nullable: true }) size!: ShirtSizeEnum | null;
  @ApiProperty() count!: number;
}

export class DashboardShirtStockDto {
  @ApiProperty() size!: ShirtSizeEnum;
  @ApiProperty() registered!: number;
  @ApiProperty() planned!: number;
  @ApiProperty() ordered!: number;
  @ApiProperty() received!: number;
}

export class DashboardPersonDto {
  @ApiProperty() id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() role_id!: number;
  @ApiProperty() role_name!: string;
  @ApiProperty({ required: false, nullable: true })
  shirt_size!: ShirtSizeEnum | null;
  @ApiProperty() contract_status!: string;
  @ApiProperty({ required: false, nullable: true })
  checked_in_at!: string | null;
  @ApiProperty() payment_status!: string;
  @ApiProperty({ required: false, nullable: true })
  avatar_photo_url!: string | null;
}

export class DashboardResponseDto {
  @ApiProperty() event_id!: number;
  @ApiProperty() event_name!: string;
  @ApiProperty() last_updated!: string;

  @ApiProperty() total_roles!: number;

  /** Total registrations for this event (all statuses, for KPI header). */
  @ApiProperty() total!: number;

  // v1.4 state-machine KPI cards — one per operational status.
  @ApiProperty() pending_approval!: number;
  @ApiProperty() approved!: number;
  @ApiProperty() contract_sent!: number;
  @ApiProperty() contract_signed!: number;
  @ApiProperty() qr_sent!: number;
  @ApiProperty() checked_in!: number;
  @ApiProperty() completed!: number;
  @ApiProperty() waitlisted!: number;
  @ApiProperty() rejected!: number;
  @ApiProperty() cancelled!: number;

  // Legacy aggregate KPIs — kept so existing admin dashboard UI doesn't
  // break during rollout; these are derived from the status counts.
  @ApiProperty({
    description:
      'Legacy: count of rows in any post-approval status (approved..completed). Retained for dashboard backward-compat.',
  })
  total_approved!: number;
  @ApiProperty() total_checked_in!: number;
  @ApiProperty() checkin_rate!: number;
  @ApiProperty() total_contract_signed!: number;
  @ApiProperty() total_contract_unsigned!: number;
  @ApiProperty() total_paid!: number;
  @ApiProperty() total_suspicious!: number;

  @ApiProperty({ type: [DashboardRoleBreakdownDto] })
  by_role!: DashboardRoleBreakdownDto[];

  @ApiProperty({ type: [DashboardShirtSizeDto] })
  shirt_sizes!: DashboardShirtSizeDto[];

  @ApiProperty() total_shirt_registered!: number;

  @ApiProperty({ type: [DashboardShirtStockDto] })
  shirt_stock!: DashboardShirtStockDto[];

  @ApiProperty({ type: [DashboardPersonDto] })
  people!: DashboardPersonDto[];

  @ApiProperty() people_total!: number;
}
