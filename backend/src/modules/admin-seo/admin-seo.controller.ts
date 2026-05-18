import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../logto-auth';
import { SeoSlugSyncService } from '../races/services/seo-slug-sync.service';
import {
  SeoSyncResultDto,
  SeoSyncLogDto,
} from './dto/seo-sync-result.dto';

/**
 * FEATURE-036 — Admin endpoints for SEO slug sync.
 *
 * - POST /api/admin/seo/sync-slugs — manual trigger (BR-07)
 * - GET /api/admin/seo/sync-logs?limit=10 — recent run history
 *
 * Auth: LogtoAdminGuard (same as other admin endpoints — 5BIB Back-Office only).
 */
@ApiTags('Admin SEO')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin/seo')
export class AdminSeoController {
  constructor(private readonly service: SeoSlugSyncService) {}

  @Post('sync-slugs')
  @ApiOperation({
    summary: 'Manual trigger SEO slug sync (admin only)',
    description: 'Run same logic as weekly cron — backfill missing slugs + revalidate frontend.',
  })
  @ApiResponse({ status: 200, type: SeoSyncResultDto })
  @ApiResponse({ status: 409, description: 'Sync already running (lock conflict)' })
  async triggerSync(@Request() req: { user?: { id?: string } }): Promise<SeoSyncResultDto> {
    const userId = req.user?.id;
    return this.service.syncSlugs('manual', userId);
  }

  @Get('sync-logs')
  @ApiOperation({ summary: 'Get recent SEO slug sync run history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max entries (default 10)' })
  @ApiResponse({ status: 200, type: [SeoSyncLogDto] })
  async getLogs(@Query('limit') limit?: string): Promise<SeoSyncLogDto[]> {
    const n = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const logs = await this.service.getRecentLogs(n);
    return logs.map((log) => {
      const doc = log as unknown as {
        _id: { toString(): string };
        startedAt: Date;
        finishedAt?: Date;
        triggeredBy: 'cron' | 'manual';
        userId?: string;
        racesScanned: number;
        slugsGenerated: number;
        revalidatedPaths: string[];
        errors: string[];
        durationMs: number;
        lockSkipped: boolean;
      };
      return {
        id: doc._id.toString(),
        startedAt: doc.startedAt,
        finishedAt: doc.finishedAt,
        triggeredBy: doc.triggeredBy,
        userId: doc.userId,
        racesScanned: doc.racesScanned,
        slugsGenerated: doc.slugsGenerated,
        revalidatedPaths: doc.revalidatedPaths ?? [],
        errors: doc.errors ?? [],
        durationMs: doc.durationMs,
        lockSkipped: doc.lockSkipped ?? false,
      };
    });
  }
}
