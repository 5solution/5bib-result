import { ApiProperty } from '@nestjs/swagger';

export class AuditPeriodBoundaryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenant_id: number;

  @ApiProperty()
  tenant_name: string;

  @ApiProperty()
  race_title: string;

  @ApiProperty({ description: 'Stored period_start YYYY-MM-DD' })
  period_start: string;

  @ApiProperty({ description: 'Stored period_end YYYY-MM-DD' })
  period_end: string;

  @ApiProperty({ description: 'Expected period_start (1st of stored start month)' })
  expected_period_start: string;

  @ApiProperty({ description: 'Expected period_end (last day of stored end month)' })
  expected_period_end: string;

  @ApiProperty({ description: 'Diff in days between stored vs expected start' })
  deviation_start_days: number;

  @ApiProperty({ description: 'Diff in days between stored vs expected end' })
  deviation_end_days: number;
}

export class AuditPeriodBoundaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: [AuditPeriodBoundaryItemDto] })
  items: AuditPeriodBoundaryItemDto[];
}
