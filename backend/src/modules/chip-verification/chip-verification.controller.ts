import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';
import type { AuthenticatedRequest } from '../logto-auth/types';
import { RaceScopeGuard } from './guards/race-scope.guard';
import { MulterErrorFilter } from './utils/multer-error.filter';
import { ChipMappingService } from './services/chip-mapping.service';
import { ChipConfigService } from './services/chip-config.service';
import { ChipCacheService } from './services/chip-cache.service';
import { ChipStatsService } from './services/chip-stats.service';
import {
  ConfirmImportRequestDto,
  ConfirmImportResponseDto,
  ImportPreviewResponseDto,
} from './dto/import-chip-mapping.dto';
import {
  ChipMappingItemDto,
  ListChipMappingsQueryDto,
  ListChipMappingsResponseDto,
  UpdateChipMappingDto,
} from './dto/chip-mapping.dto';
import {
  CacheActionRequestDto,
  CacheActionResponseDto,
  ChipConfigLinkResponseDto,
  ChipConfigResponseDto,
  LinkMongoRaceRequestDto,
  TokenActionRequestDto,
  TokenActionResponseDto,
} from './dto/chip-verify-token.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ChipRedisKeys } from './utils/redis-keys';
import { ChipStatsResponseDto } from './dto/chip-lookup.dto';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB upper-bound (5K rows ~ 250KB; gives headroom)

@ApiTags('chip-verification (admin)')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(LogtoAdminGuard)
export class ChipVerificationController {
  private readonly logger = new Logger(ChipVerificationController.name);

  constructor(
    private readonly mappingService: ChipMappingService,
    private readonly configService: ChipConfigService,
    private readonly cacheService: ChipCacheService,
    private readonly statsService: ChipStatsService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─────────── MONGO ↔ MYSQL LINK ───────────
  // 5bib-result Mongo Race và 5bib_platform_live MySQL race là 2 hệ thống
  // tách biệt. BTC phải nhập tay mysql_race_id để link race admin sang race
  // platform. Sau khi link, các endpoint khác dùng mysql_race_id như cũ.

  @Get('races/by-mongo/:mongoRaceId/chip-verify/config')
  @ApiOperation({
    summary: 'Get chip-verify config by Mongo Race._id (admin URL)',
    description:
      'Returns config nếu race này đã được link tới MySQL race_id. 404 nếu chưa link → admin UI phải hiển thị form nhập mysql_race_id.',
  })
  @ApiResponse({ status: 200, type: ChipConfigLinkResponseDto })
  @ApiResponse({ status: 404, description: 'Race chưa được link' })
  async getConfigByMongoId(
    @Param('mongoRaceId') mongoRaceId: string,
  ): Promise<ChipConfigLinkResponseDto> {
    const cfg = await this.configService.findByMongoId(mongoRaceId);
    if (!cfg) {
      throw new NotFoundException(
        'Race admin chưa được link tới MySQL platform race_id. Nhập mysql_race_id để link.',
      );
    }
    return {
      mongo_race_id: cfg.mongo_race_id ?? mongoRaceId,
      mysql_race_id: cfg.mysql_race_id,
      chip_verify_enabled: cfg.chip_verify_enabled,
      total_chip_mappings: cfg.total_chip_mappings,
    };
  }

  @Post('races/by-mongo/:mongoRaceId/chip-verify/link')
  @ApiOperation({
    summary: 'Link Mongo Race ↔ MySQL platform race_id',
    description:
      'BTC nhập mysql_race_id (numeric, từ 5bib_platform_live.races). Idempotent — re-link cùng id OK. Re-link sang id KHÁC chỉ allow nếu chưa có chip mapping nào.',
  })
  @ApiResponse({ status: 201, type: ChipConfigLinkResponseDto })
  @ApiResponse({ status: 400, description: 'Re-link bị block vì đã có mapping' })
  async linkMongoToMysql(
    @Param('mongoRaceId') mongoRaceId: string,
    @Body() body: LinkMongoRaceRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChipConfigLinkResponseDto> {
    const userId = req.user?.userId ?? 'unknown';
    const cfg = await this.configService.linkMongoToMysql({
      mongoRaceId,
      mysqlRaceId: body.mysql_race_id,
      tenantId: 0, // back-office single-tenant trust boundary
      byUserId: userId,
    });
    return {
      mongo_race_id: cfg.mongo_race_id ?? mongoRaceId,
      mysql_race_id: cfg.mysql_race_id,
      chip_verify_enabled: cfg.chip_verify_enabled,
      total_chip_mappings: cfg.total_chip_mappings,
    };
  }

  // ─────────── CSV IMPORT ───────────

  @Post('races/:raceId/chip-mappings/import')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({
    summary: 'Preview CSV upload (chip_id, bib_number columns)',
    description:
      'Returns counts + previewToken (TTL 10m). Confirm via /chip-mappings/import/confirm.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, type: ImportPreviewResponseDto })
  @UseFilters(MulterErrorFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CSV_BYTES },
    }),
  )
  async previewImport(
    @Param('raceId', ParseIntPipe) raceId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ): Promise<ImportPreviewResponseDto> {
    const userId = req.user?.userId ?? 'unknown';
    return this.mappingService.previewImport(raceId, userId, file.buffer);
  }

  @Post('races/:raceId/chip-mappings/import/confirm')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({ summary: 'Confirm CSV import using previewToken' })
  @ApiResponse({ status: 200, type: ConfirmImportResponseDto })
  async confirmImport(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() body: ConfirmImportRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ConfirmImportResponseDto> {
    const userId = req.user?.userId ?? 'unknown';
    const { imported, mappings } = await this.mappingService.confirmImport(
      body.previewToken,
      raceId,
      userId,
    );
    // If verify already enabled, patch cache for newly-imported mappings.
    const cfg = await this.configService.findByRace(raceId);
    if (cfg?.chip_verify_enabled && mappings.length > 0) {
      // Best-effort delta patch — don't block on errors
      this.cacheService
        .patchDelta(raceId)
        .catch(() => undefined);
    }
    return { imported };
  }

  // ─────────── LIST / EDIT / DELETE ───────────

  @Get('races/:raceId/chip-mappings')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({ summary: 'List chip mappings for race' })
  @ApiResponse({ status: 200, type: ListChipMappingsResponseDto })
  async list(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Query() query: ListChipMappingsQueryDto,
  ): Promise<ListChipMappingsResponseDto> {
    return this.mappingService.list(raceId, query);
  }

  @Put('races/:raceId/chip-mappings/:id')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({ summary: 'Update single chip mapping (race-scoped)' })
  @ApiResponse({ status: 200, type: ChipMappingItemDto })
  async update(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Param('id') id: string,
    @Body() body: UpdateChipMappingDto,
  ): Promise<ChipMappingItemDto> {
    return this.mappingService.update(id, raceId, body);
  }

  @Delete('races/:raceId/chip-mappings/:id')
  @UseGuards(RaceScopeGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete chip mapping' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const userId = req.user?.userId ?? 'unknown';
    await this.mappingService.softDelete(id, raceId, userId);
  }

  // ─────────── TOKEN + CACHE ───────────

  @Post('races/:raceId/chip-verify/token')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({
    summary: 'GENERATE | ROTATE | DISABLE chip verify token',
    description:
      'GENERATE = enable + new token (idempotent). ROTATE = new token + invalidate old immediately. DISABLE = clear token + cache.',
  })
  @ApiResponse({ status: 200, type: TokenActionResponseDto })
  async tokenAction(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() body: TokenActionRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TokenActionResponseDto> {
    const userId = req.user?.userId ?? 'unknown';
    // Try to get tenant_id from existing config; fall back to 0 (back-office
    // adminship is the auth boundary, not tenant id, but we still snapshot it).
    const existing = await this.configService.findByRace(raceId);
    const tenantId = existing?.tenant_id ?? 0;

    const cfg = await this.configService.tokenAction(
      raceId,
      tenantId,
      body.action,
      userId,
    );

    // GENERATE → preload best-effort (don't block — admin sees progress on stats)
    if (body.action === 'GENERATE' && cfg.chip_verify_enabled) {
      this.cacheService.preload(raceId).catch((err: unknown) => {
        const e = err as Error;
        // BUG #5 fix — use Nest Logger instead of console.error so logs get
        // [Nest] prefix + structured by environment.
        this.logger.error(
          `[preload-async] race=${raceId} failed: ${e.message}`,
          e.stack,
        );
      });
    }

    return {
      token: cfg.chip_verify_token ?? null,
      chip_verify_enabled: cfg.chip_verify_enabled,
      total_chip_mappings: cfg.total_chip_mappings,
      preload_completed_at: cfg.preload_completed_at ?? null,
    };
  }

  @Get('races/:raceId/chip-verify/config')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({
    summary: 'Get chip verify config (enabled state, mapping count, cache status)',
    description:
      'Token plaintext NOT returned — admin must call POST /token to GENERATE/ROTATE để lấy plaintext. Trả null vì security (URL share-once).',
  })
  @ApiResponse({ status: 200, type: ChipConfigResponseDto })
  async getConfig(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<ChipConfigResponseDto> {
    // Count active mappings từ collection thay vì stale `cfg.total_chip_mappings`
    // (chỉ update khi preload chạy — sau import CSV chưa update). Logic này
    // đảm bảo `canEnable` ở admin UI phản ánh đúng số mapping hiện tại.
    const [cfg, cacheReadyRaw, actualMappingCount] = await Promise.all([
      this.configService.findByRace(raceId),
      this.redis.get(ChipRedisKeys.cacheReady(raceId)),
      this.statsService.forRace(raceId).then((s) => s.total_mappings),
    ]);

    return {
      chip_verify_enabled: cfg?.chip_verify_enabled ?? false,
      chip_verify_token: null, // security: never return plaintext on GET
      total_chip_mappings: actualMappingCount,
      preload_completed_at: cfg?.preload_completed_at ?? null,
      cache_ready: cacheReadyRaw === '1',
    };
  }

  @Get('races/:raceId/chip-verify/stats')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({ summary: 'Race-level chip verify stats' })
  @ApiResponse({ status: 200, type: ChipStatsResponseDto })
  async stats(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<ChipStatsResponseDto> {
    return this.statsService.forRace(raceId);
  }

  @Post('races/:raceId/chip-verify/cache')
  @UseGuards(RaceScopeGuard)
  @ApiOperation({ summary: 'REFRESH (full preload) | CLEAR cache' })
  @ApiResponse({ status: 200, type: CacheActionResponseDto })
  async cacheAction(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() body: CacheActionRequestDto,
  ): Promise<CacheActionResponseDto> {
    if (body.action === 'CLEAR') {
      await this.cacheService.clearCache(raceId);
      return {
        success: true,
        cached_count: 0,
        preload_completed_at: null,
      };
    }
    const result = await this.cacheService.preload(raceId);
    const cfg = await this.configService.findByRace(raceId);
    return {
      success: true,
      cached_count: result.cached_count,
      preload_completed_at: cfg?.preload_completed_at ?? null,
    };
  }
}
