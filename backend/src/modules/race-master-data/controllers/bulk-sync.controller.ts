/**
 * FEATURE-048 Phase 1B — Bulk sync admin endpoints (BR-48-09).
 */

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
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
  BulkSyncMode,
  BulkSyncOrchestratorService,
} from '../services/bulk-sync-orchestrator.service';

export class BulkSyncTriggerDto {
  @ApiProperty({ enum: ['staged_10', 'staged_50', 'full'] })
  @IsEnum(['staged_10', 'staged_50', 'full'], {
    message: 'mode phải là staged_10 | staged_50 | full',
  })
  mode: BulkSyncMode;

  @ApiPropertyOptional({
    description: 'Required ≥10 chars when mode=full (audit log)',
    minLength: 10,
    maxLength: 1000,
  })
  @IsOptional()
  @ValidateIf((o: BulkSyncTriggerDto) => o.mode === 'full')
  @IsString()
  @MinLength(10, { message: 'reason ≥10 ký tự bắt buộc cho mode=full' })
  @MaxLength(1000)
  reason?: string;
}

@ApiTags('admin-race-master-data')
@ApiBearerAuth()
@Controller('admin/race-master-data')
@UseGuards(LogtoAdminGuard)
export class BulkSyncController {
  constructor(private readonly orchestrator: BulkSyncOrchestratorService) {}

  /** BR-48-09 — Trigger staged bulk sync. Returns runId for polling. */
  @Post('full-sync-all')
  @ApiOperation({
    summary: 'F-048 — Trigger staged bulk sync (10/50/195 mode)',
  })
  @ApiResponse({ status: 202, description: 'Sync triggered, returns runId' })
  @ApiResponse({ status: 400, description: 'Validation fail' })
  @ApiResponse({ status: 409, description: 'Sync already running' })
  async trigger(
    @Body() body: BulkSyncTriggerDto,
    @CurrentUser() admin: LogtoUser,
  ) {
    return this.orchestrator.triggerBulkSync(body.mode, admin.sub, body.reason);
  }

  /** Get progress + status of running/completed sync. */
  @Get('sync-status/:runId')
  @ApiOperation({ summary: 'F-048 — Get bulk sync run status' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getStatus(@Param('runId') runId: string) {
    const status = await this.orchestrator.getSyncStatus(runId);
    if (!status) throw new NotFoundException('Run không tồn tại hoặc hết TTL 24h');
    return status;
  }

  /** Overall sync coverage + current stage. */
  @Get('sync-overall-status')
  @ApiOperation({ summary: 'F-048 — Overall sync stage + race coverage %' })
  @ApiResponse({ status: 200 })
  async getOverall() {
    return this.orchestrator.getOverallStatus();
  }
}
