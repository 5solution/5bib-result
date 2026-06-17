/**
 * F-076 — admin invoice reconcile endpoints.
 *
 * 3 endpoints under prefix `/api/admin/invoice-reconcile/*`:
 *   - GET /today    — cached report (admin UI fast load)
 *   - POST /trigger — manual reconcile (lock-aware, returns 409 if busy)
 *   - GET /health   — module health (env masked)
 *
 * All gated by `LogtoFinanceGuard` (role admin or scope admin).
 * `POST /trigger` rate-limited 6/min/user via ThrottlerGuard.
 */
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Logger,
  Optional,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { env } from 'src/config';
import { LogtoFinanceGuard } from '../logto-auth';
import { AuditLogService } from '../audit/services/audit-log.service';
import { InvoiceReconcileService } from './services/invoice-reconcile.service';
import { MisaMeinvoiceClient } from './services/misa-meinvoice.client';
import { InvoiceTelegramClient } from './services/invoice-telegram.client';
import { ReconcileReportDto } from './dto/reconcile-report.dto';
import { ReconcileHealthDto } from './dto/reconcile-health.dto';
import {
  ResolveOrderDto,
  ResolveOrderResultDto,
  SendHeartbeatResultDto,
} from './dto/resolve-order.dto';

@ApiTags('admin-invoice-reconcile')
@ApiBearerAuth()
@UseGuards(LogtoFinanceGuard, ThrottlerGuard)
@Controller('admin/invoice-reconcile')
export class InvoiceReconcileController {
  private readonly logger = new Logger(InvoiceReconcileController.name);

  constructor(
    private readonly reconcile: InvoiceReconcileService,
    private readonly misa: MisaMeinvoiceClient,
    private readonly telegram: InvoiceTelegramClient,
    @Optional() private readonly audit?: AuditLogService,
  ) {}

  @Get('today')
  @ApiOperation({
    summary:
      'F-076 — Cached reconcile report cho admin dashboard. Cache 24h Redis.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'yyyy-MM-dd ICT (default today)',
  })
  @ApiResponse({ status: 200, type: ReconcileReportDto })
  async getToday(@Query('date') date?: string): Promise<ReconcileReportDto> {
    const targetDate = this.resolveDate(date);
    const base = await this.getBaseReport(targetDate);
    // F-088 — enrich với cumulative + errorBreakdown + dailyCounters + resolved flags
    return this.reconcile.enrichReport(targetDate, base);
  }

  /** Base report: cache → scan inline (lock-aware) → empty placeholder. */
  private async getBaseReport(targetDate: string): Promise<ReconcileReportDto> {
    const cached = await this.reconcile.getCachedReport(targetDate);
    if (cached) return cached;
    const acquired = await this.reconcile.tryAcquireLock();
    if (!acquired) {
      await this.sleep(500);
      const cached2 = await this.reconcile.getCachedReport(targetDate);
      if (cached2) return cached2;
      return this.emptyPlaceholder(targetDate);
    }
    try {
      return await this.reconcile.scan(targetDate, 'cron');
    } finally {
      await this.reconcile.releaseLock();
    }
  }

  @Post('send-heartbeat')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'F-088 — Gửi heartbeat Telegram ngay (admin bấm nút). Rate-limit 3/phút.',
  })
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiResponse({ status: 200, type: SendHeartbeatResultDto })
  async sendHeartbeat(): Promise<SendHeartbeatResultDto> {
    const date = this.resolveDate(undefined);
    const { sent } = await this.reconcile.runHourlyRecap(date);
    await this.audit?.emit({
      actor: { userId: 'unknown', role: 'admin' },
      action: 'invoice_reconcile.heartbeat_sent',
      entity: { type: 'invoice-reconcile', id: date },
      metadata: { sent },
    });
    return { sent };
  }

  @Post('resolve')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'F-088 — Đánh dấu / bỏ đánh dấu 1 đơn "đã xử lý" (ẩn khỏi danh sách). ' +
      'State nội bộ — KHÔNG ảnh hưởng đối soát thật.',
  })
  @ApiResponse({ status: 200, type: ResolveOrderResultDto })
  async resolveOrder(
    @Body() body: ResolveOrderDto,
  ): Promise<ResolveOrderResultDto> {
    const date = this.resolveDate(body.date);
    await this.reconcile.markOrderResolved(date, body.orderId, body.resolved);
    await this.audit?.emit({
      actor: { userId: 'unknown', role: 'admin' },
      action: 'invoice_reconcile.order_resolved',
      entity: { type: 'invoice-reconcile-order', id: String(body.orderId) },
      metadata: { resolved: body.resolved },
    });
    return { orderId: body.orderId, resolved: body.resolved };
  }

  @Post('trigger')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'F-076 — Manual reconcile trigger (admin). 409 nếu lock busy (cron đang chạy).',
  })
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiResponse({ status: 200, type: ReconcileReportDto })
  @ApiResponse({
    status: 409,
    description: 'Đang có cron khác chạy, thử lại sau 5 phút',
  })
  async triggerReconcile(): Promise<ReconcileReportDto> {
    const date = this.resolveDate(undefined);
    const acquired = await this.reconcile.tryAcquireLock();
    if (!acquired) {
      throw new ConflictException({
        code: 'RECONCILE_IN_PROGRESS',
        message: 'Đang có cron khác chạy, thử lại sau 5 phút',
      });
    }
    try {
      const report = await this.reconcile.scan(date, 'manual');
      // Audit log emit (Optional inject — fail-soft)
      await this.audit?.emit({
        actor: { userId: 'unknown', role: 'admin' },
        action: 'invoice_reconcile.triggered',
        entity: { type: 'invoice-reconcile', id: date },
        metadata: {
          missingCount: report.missingCount,
          atRiskCount: report.atRiskCount,
          duplicateCount: report.duplicateCount,
          layer2Status: report.layer2Status,
        },
      });
      // F-088 — enrich để FE giữ card cumulative/error/resolved sau khi trigger.
      return this.reconcile.enrichReport(date, report);
    } finally {
      await this.reconcile.releaseLock();
    }
  }

  @Get('health')
  @ApiOperation({
    summary:
      'F-076 — Module health: cron last tick, MISA status, Telegram configured, thresholds.',
  })
  @ApiResponse({ status: 200, type: ReconcileHealthDto })
  async getHealth(): Promise<ReconcileHealthDto> {
    const lastScan = this.reconcile.getLastScanTickAt();
    const tokenExpiry = await this.misa.getTokenExpiry();
    return {
      lastScanTickAt: lastScan ? lastScan.toISOString() : null,
      enabledRaceIds: this.reconcile.getEnabledRaceIds(),
      misaTokenExpiresAt: tokenExpiry ? tokenExpiry.toISOString() : null,
      lastMisaStatus: this.misa.getLastStatus(),
      misaConfigured: this.misa.isConfigured(),
      telegramConfigured: this.telegram.isConfigured(),
      telegramChatIdMasked: this.telegram.getChatIdMasked(),
      emailRecipientsMasked: env.invoiceReconcile.alertEmails.map((e) =>
        maskEmail(e),
      ),
      thresholds: {
        warnHours: env.invoiceReconcile.ageWarnHours,
        criticalHours: env.invoiceReconcile.ageCriticalHours,
        breachedHours: env.invoiceReconcile.ageBreachedHours,
      },
    };
  }

  private resolveDate(date: string | undefined): string {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return this.isoDateIct(new Date());
  }

  private isoDateIct(now: Date): string {
    const ict = new Date(now.getTime() + 7 * 3_600_000);
    const yyyy = ict.getUTCFullYear();
    const mm = String(ict.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(ict.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private emptyPlaceholder(date: string): ReconcileReportDto {
    return {
      date,
      runAt: new Date().toISOString(),
      mode: 'cron',
      raceIdsScanned: this.reconcile.getEnabledRaceIds(),
      expectedCount: 0,
      issuedCount: 0,
      missingCount: 0,
      atRiskCount: 0,
      duplicateCount: 0,
      breachedCount: 0,
      missing: [],
      misaOrphan: [],
      layer2Status: this.misa.isConfigured() ? 'OK' : 'UNAVAILABLE',
      maxSeverity: 'INFO',
      alertSent: false,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}

function maskEmail(s: string): string {
  if (!s) return '';
  const [local, domain] = s.split('@');
  if (!domain) return s.slice(0, 2) + '***';
  const localMasked = local.length <= 2 ? local : local.slice(0, 2) + '***';
  return `${localMasked}@${domain}`;
}
