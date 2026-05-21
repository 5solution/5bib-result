/**
 * FEATURE-048 Phase 1A — Admin endpoint to trigger races.mysql_race_id backfill.
 *
 * PAUSE point #1 (Manager Plan): Dry-run gate MUST be used FIRST before --apply.
 *
 * Endpoints:
 *   - POST /api/admin/race-master-data/run-mysql-id-backfill?dryRun=true|false
 *
 * Auth: LogtoAdminGuard — admin or super_admin role required (PII migration access).
 */

import {
  Body,
  Controller,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  LogtoAdminGuard,
  CurrentUser,
  type LogtoUser,
} from '../../logto-auth';
import {
  BackfillReport,
  RaceMysqlIdBackfillService,
} from '../services/race-mysql-id-backfill.service';

export class RunBackfillDto {
  @ApiProperty({
    description:
      'Required reason (≥10 chars) when dryRun=false. Logged for audit.',
    minLength: 10,
    maxLength: 1000,
    required: false,
  })
  @IsOptional()
  @ValidateIf((o: RunBackfillDto, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(10, {
    message: 'Lý do tối thiểu 10 ký tự — bắt buộc khi --apply',
  })
  @MaxLength(1000)
  reason?: string;
}

@ApiTags('admin-race-master-data')
@ApiBearerAuth()
@Controller('admin/race-master-data')
@UseGuards(LogtoAdminGuard)
export class RaceMysqlIdBackfillController {
  private readonly logger = new Logger(RaceMysqlIdBackfillController.name);

  constructor(
    private readonly backfillService: RaceMysqlIdBackfillService,
  ) {}

  /**
   * F-048 BR-48-01/02 — Trigger race mysql_race_id backfill.
   *
   * `?dryRun=true` (default) — Compute matches only, NO MongoDB writes.
   * `?dryRun=false` — Apply matches, requires reason ≥10 chars in body.
   */
  @Post('run-mysql-id-backfill')
  @ApiOperation({
    summary:
      'F-048 — Backfill races.mysql_race_id via hybrid 2-tier matching (BR-48-02)',
  })
  @ApiQuery({
    name: 'dryRun',
    required: false,
    type: Boolean,
    description: 'true (default) = compute only, false = apply writes',
  })
  @ApiResponse({ status: 200, description: 'Backfill report' })
  @ApiResponse({
    status: 400,
    description: 'reason required when dryRun=false',
  })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not admin role' })
  async runBackfill(
    @Query('dryRun') dryRunQuery: string | undefined,
    @Body() body: RunBackfillDto,
    @CurrentUser() admin: LogtoUser,
  ): Promise<BackfillReport> {
    // Default safety: dryRun=true unless explicitly 'false'
    const dryRun = dryRunQuery !== 'false';

    if (!dryRun && (!body.reason || body.reason.length < 10)) {
      // BR-48-09 — audit reason required for --apply
      throw new Error('Lý do tối thiểu 10 ký tự — bắt buộc khi --apply');
    }

    this.logger.log(
      `[run-backfill] admin=${admin.sub} dryRun=${dryRun} reason=${body.reason ?? '<none>'}`,
    );

    return this.backfillService.runBackfill(dryRun);
  }
}
