/**
 * F-076 BR-10 + BR-19 + BR-21 + BR-25..31 — orchestrator 7 loại alert.
 *
 * Responsibilities:
 *   - SETNX dedup Redis keys per loại
 *   - Telegram primary via InvoiceTelegramClient (BOT RIÊNG F-076)
 *   - Email fallback via MailService.sendCustomHtml (chỉ khi Telegram fail)
 *   - Daily counters increment per alert sent
 *
 * Pure side-effect service. Compose HTML qua alert-composer.ts.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { env } from 'src/config';
import { MailService } from '../../notification/mail.service';
import {
  InvoiceTelegramClient,
  TelegramKickedError,
  TelegramSendError,
} from './invoice-telegram.client';
import { DailyCountersService } from './daily-counters.service';
import { ReconcileReportDto } from '../dto/reconcile-report.dto';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';
import {
  composeBreachedAlert,
  composeCriticalAlert,
  composeDuplicateAlert,
  composeEodRecap,
  composeHourlyRecap,
  composeMisaAuthFailAlert,
  composeMisaUnavailableAlert,
  composeWarnAlert,
} from './alert-composer';
import { ageBucket4h } from './reconcile-classifier';
import { DiffEvent } from './diff-computer';

const DEDUP_KEYS = {
  warn: (date: string, orderId: number, bucket: number) =>
    `invoice-reconcile:alert:warn:${date}:${orderId}:${bucket}`,
  critical: (date: string, orderId: number, bucket: number) =>
    `invoice-reconcile:alert:critical:${date}:${orderId}:${bucket}`,
  breached: (orderId: number) =>
    `invoice-reconcile:alert:breached:${orderId}`,
  duplicate: (date: string, orderId: number) =>
    `invoice-reconcile:alert:duplicate:${date}:${orderId}`,
  misaDown: (date: string, hour: number) =>
    `invoice-reconcile:alert:misa-down:${date}:${hour}`,
  misaAuth: (date: string) => `invoice-reconcile:alert:misa-auth:${date}`,
};

const TTL = {
  perDay: 24 * 3600,
  perWeek: 7 * 24 * 3600,
  perHour: 3600,
};

@Injectable()
export class InvoiceAlertService {
  private readonly logger = new Logger(InvoiceAlertService.name);

  constructor(
    private readonly telegram: InvoiceTelegramClient,
    private readonly counters: DailyCountersService,
    @Optional() private readonly mail?: MailService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  private dashboardUrl(): string {
    // Default PROD admin URL — không leak env, just convention
    return 'https://admin.5bib.com/invoice-reconcile';
  }

  /** Emit URGENT alerts (Loại 2/3/4/5) from scan tick detected rows. */
  async emitUrgentAlerts(
    date: string,
    report: ReconcileReportDto,
    _diffEvents: DiffEvent[],
  ): Promise<{ sent: number }> {
    let sent = 0;
    for (const row of report.missing) {
      try {
        if (row.bucket === 'DUPLICATE') {
          if (await this.sendDuplicate(date, row)) sent++;
        } else if (row.bucket === 'UNISSUED') {
          if (row.breached) {
            if (await this.sendBreached(row)) sent++;
          } else if (row.severity === 'CRITICAL') {
            if (await this.sendCritical(date, row)) sent++;
          } else if (row.severity === 'WARN') {
            if (await this.sendWarn(date, row)) sent++;
          }
        }
      } catch (e) {
        this.logger.error(
          `[alert] emit fail orderId=${row.orderId}: ${(e as Error).message}`,
        );
      }
    }
    return { sent };
  }

  /**
   * F-076 BR-25 + F-079 BR-79-04..06 — Heartbeat/Recap.
   *
   * F-079: ALWAYS send (relax BR-25 skip-when-OK condition). Heartbeat semantics
   * — Danny + Hiền visibility cron alive kể cả khi missing=0.
   * Cron 2h/lần (8 tick/ngày, 8h-22h ICT) đảm bảo no duplicate without dedup.
   *
   * `raceTitlesByid` Map resolved bởi caller (InvoiceReconcileService) qua
   * F-049 `AthleteIdentityClusteringService.getRaceTitlesByMysqlIds()`.
   * Default empty Map → composer fallback `Race {raceId}` per BR-79-23.
   */
  async sendHourlyRecap(
    report: ReconcileReportDto,
    diffEvents: DiffEvent[],
    raceTitlesByid: Map<number, string> = new Map(),
  ): Promise<boolean> {
    const html = composeHourlyRecap(
      report,
      diffEvents,
      this.dashboardUrl(),
      raceTitlesByid,
    );
    return this.dispatch(html, 'hourly-recap');
  }

  /** BR-31 Loại 7 — EOD Daily Recap. Send always at 21:00 ICT. */
  async sendEodRecap(
    date: string,
    report: ReconcileReportDto,
  ): Promise<boolean> {
    const counters = await this.counters.getAll(date);
    const html = composeEodRecap(report, counters, this.dashboardUrl());
    const ok = await this.dispatch(html, 'eod-recap');
    // Mark EOD sent (gate skip Hourly 21:00)
    if (this.redis) {
      try {
        await this.redis.set(
          `invoice-reconcile:eod-alert-sent:${date}`,
          '1',
          'EX',
          6 * 3600,
        );
      } catch (e) {
        this.logger.warn(
          `[alert] mark eod sent fail: ${(e as Error).message}`,
        );
      }
    }
    return ok;
  }

  /** BR-26 Loại 2 — WARN (dedup by orderId + 4h bucket per day). */
  private async sendWarn(
    date: string,
    row: MissingInvoiceRowDto,
  ): Promise<boolean> {
    const bucket = ageBucket4h(row.ageHours);
    const key = DEDUP_KEYS.warn(date, row.orderId, bucket);
    if (!(await this.acquireDedup(key, TTL.perDay))) return false;
    const html = composeWarnAlert(
      row,
      this.dashboardUrl(),
      env.invoiceReconcile.ageWarnHours,
      env.invoiceReconcile.ageBreachedHours,
    );
    const ok = await this.dispatch(html, 'warn');
    if (ok) await this.counters.increment(date, 'alert-warn');
    return ok;
  }

  /** BR-27 Loại 3 — CRITICAL. */
  private async sendCritical(
    date: string,
    row: MissingInvoiceRowDto,
  ): Promise<boolean> {
    const bucket = ageBucket4h(row.ageHours);
    const key = DEDUP_KEYS.critical(date, row.orderId, bucket);
    if (!(await this.acquireDedup(key, TTL.perDay))) return false;
    const html = composeCriticalAlert(
      row,
      this.dashboardUrl(),
      env.invoiceReconcile.ageBreachedHours,
    );
    const ok = await this.dispatch(html, 'critical');
    if (ok) await this.counters.increment(date, 'alert-critical');
    return ok;
  }

  /** BR-28 Loại 4 — BREACHED (dedup per đơn per week, không lặp). */
  private async sendBreached(row: MissingInvoiceRowDto): Promise<boolean> {
    const key = DEDUP_KEYS.breached(row.orderId);
    if (!(await this.acquireDedup(key, TTL.perWeek))) return false;
    const html = composeBreachedAlert(row, this.dashboardUrl());
    const ok = await this.dispatch(html, 'breached');
    if (ok) {
      // We use the current ICT date for counters
      const today = isoDateIct(new Date());
      await this.counters.increment(today, 'alert-breached');
    }
    return ok;
  }

  /** BR-29 Loại 5 — DUPLICATE (dedup per đơn per day). */
  private async sendDuplicate(
    date: string,
    row: MissingInvoiceRowDto,
  ): Promise<boolean> {
    const key = DEDUP_KEYS.duplicate(date, row.orderId);
    if (!(await this.acquireDedup(key, TTL.perDay))) return false;
    const html = composeDuplicateAlert(row, this.dashboardUrl());
    const ok = await this.dispatch(html, 'duplicate');
    if (ok) await this.counters.increment(date, 'alert-duplicate');
    return ok;
  }

  /** BR-30 Loại 6 — MISA UNAVAILABLE. */
  async sendMisaUnavailable(date: string, lastError: string): Promise<boolean> {
    const hour = new Date().getUTCHours();
    const key = DEDUP_KEYS.misaDown(date, hour);
    if (!(await this.acquireDedup(key, TTL.perHour))) return false;
    const html = composeMisaUnavailableAlert(lastError, this.dashboardUrl());
    const ok = await this.dispatch(html, 'misa-down');
    if (ok) await this.counters.increment(date, 'alert-misa-down');
    return ok;
  }

  /** BR-30 Loại 6 — MISA AUTH_FAIL. */
  async sendMisaAuthFail(date: string, errorBody: string): Promise<boolean> {
    const key = DEDUP_KEYS.misaAuth(date);
    if (!(await this.acquireDedup(key, TTL.perDay))) return false;
    const html = composeMisaAuthFailAlert(errorBody, this.dashboardUrl());
    const ok = await this.dispatch(html, 'misa-auth');
    if (ok) await this.counters.increment(date, 'alert-misa-auth');
    return ok;
  }

  /** SETNX dedup. Returns true if acquired (caller should send). */
  private async acquireDedup(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.redis) return true; // no Redis → always send (dev mode)
    try {
      const res = await this.redis.set(key, String(Date.now()), 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (e) {
      this.logger.warn(
        `[alert] dedup acquire fail key=${key} err=${(e as Error).message}`,
      );
      // Fail-open: still send (better noise than silent miss for compliance)
      return true;
    }
  }

  /** Dispatch via Telegram primary → email fallback. */
  private async dispatch(html: string, alertKind: string): Promise<boolean> {
    if (this.telegram.isConfigured()) {
      try {
        await this.telegram.send(html);
        return true;
      } catch (e) {
        if (e instanceof TelegramKickedError) {
          this.logger.error(`[alert] telegram kicked, falling back email`);
        } else if (e instanceof TelegramSendError) {
          this.logger.warn(
            `[alert] telegram fail (${alertKind}) → email fallback: ${e.message}`,
          );
        } else {
          this.logger.error(
            `[alert] telegram unexpected (${alertKind}): ${(e as Error).message}`,
          );
        }
      }
    } else {
      this.logger.warn(
        `[alert] telegram not configured (${alertKind}) → email fallback`,
      );
    }

    // Email fallback
    return this.sendEmail(html, alertKind);
  }

  private async sendEmail(html: string, alertKind: string): Promise<boolean> {
    const emails = env.invoiceReconcile.alertEmails;
    if (emails.length === 0) {
      this.logger.warn(
        `[alert] no email recipients configured for ${alertKind} → drop`,
      );
      return false;
    }
    if (!this.mail) {
      this.logger.warn(
        `[alert] MailService not available for ${alertKind} → drop`,
      );
      return false;
    }
    const subject = `[5BIB Invoice Alert] ${alertKind.toUpperCase()} — ${isoDateIct(
      new Date(),
    )}`;
    let anyOk = false;
    for (const to of emails) {
      try {
        const ok = await this.mail.sendCustomHtml(to, subject, html);
        if (ok) anyOk = true;
      } catch (e) {
        this.logger.warn(
          `[alert] email send fail to=${to}: ${(e as Error).message}`,
        );
      }
    }
    return anyOk;
  }
}

/** Helper isoDate ICT (yyyy-MM-dd). */
function isoDateIct(now: Date): string {
  const ict = new Date(now.getTime() + 7 * 3_600_000);
  const yyyy = ict.getUTCFullYear();
  const mm = String(ict.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ict.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
