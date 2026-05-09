import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Telegram } from 'telegraf';
import { env } from '../../../config';
import { TimingAlertDocument } from '../schemas/timing-alert.schema';

/**
 * Phase 1C — Telegram CRITICAL alert dispatcher.
 *
 * Spec section M.3 + research:
 * - CRITICAL alerts trigger Telegram push (real-time visibility cho 5BIB
 *   internal team race day)
 * - Rate limit 1 message per (race, 15 minutes) — chống spam khi mat failure
 *   gây 50 alerts cùng lúc
 *
 * **Auth strategy:**
 * - Token: `TELEGRAM_BOT_TOKEN` (existing env, share với race-result)
 * - Chat ID: `TIMING_ALERT_TELEGRAM_CHAT_ID` (timing-alert specific) —
 *   PAUSE #8 default = 1 chat global cho 5BIB internal team
 * - Fallback: nếu `TIMING_ALERT_TELEGRAM_CHAT_ID` empty, dùng
 *   `TELEGRAM_GROUP_CHAT_ID` (default group chat của TelegramService)
 *
 * **Rate limit Redis:**
 * - Key: `timing-alert:tg-rate:{raceId}` SETNX EX 900 (15 min)
 * - Acquire → send. Skip nếu fail acquire (silent — không log noise).
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly telegram: Telegram | null = null;
  private readonly chatId: string | null = null;
  /**
   * Phase 2 — anomaly chat ID tách biệt với complaint channel.
   * User Danny 03/05/2026: "tạo 1 channel riêng để nhận tin này tách biệt
   * với phần khiếu nại". Env `TIMING_ALERT_ANOMALY_CHAT_ID`. Fallback về
   * main `chatId` nếu chưa set (không silent drop).
   */
  private readonly anomalyChatId: string | null = null;
  private static readonly RATE_LIMIT_TTL_SECONDS = 900; // 15 phút
  /** Anomaly cooldown ngắn hơn — mat failure cần BTC hành động ngay. */
  private static readonly ANOMALY_RATE_LIMIT_TTL_SECONDS = 600; // 10 phút

  constructor(@InjectRedis() private readonly redis: Redis) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId =
      env.timingAlert.telegramChatId ||
      process.env.TELEGRAM_GROUP_CHAT_ID ||
      '';
    const anomalyChatId =
      process.env.TIMING_ALERT_ANOMALY_CHAT_ID ||
      env.timingAlert.telegramChatId ||
      process.env.TELEGRAM_GROUP_CHAT_ID ||
      '';

    if (token && chatId) {
      this.telegram = new Telegram(token);
      this.chatId = chatId;
      this.anomalyChatId = anomalyChatId || chatId;
      this.logger.log(
        `Timing alert Telegram enabled — alert chat=${chatId.slice(0, 4)}*** anomaly chat=${this.anomalyChatId.slice(0, 4)}***`,
      );
    } else {
      this.logger.warn(
        'Timing alert Telegram disabled — missing TELEGRAM_BOT_TOKEN or chat_id ' +
          '(set TIMING_ALERT_TELEGRAM_CHAT_ID or TELEGRAM_GROUP_CHAT_ID)',
      );
    }
  }

  /**
   * Dispatch CRITICAL alert. Skip nếu rate-limited hoặc Telegram disabled.
   * Returns true nếu gửi thành công, false nếu skip (rate limit / disabled / err).
   */
  async dispatchCritical(alert: TimingAlertDocument): Promise<boolean> {
    if (!this.telegram || !this.chatId) return false;

    const acquired = await this.tryAcquireRateLimit(alert.race_id);
    if (!acquired) {
      this.logger.debug(
        `[dispatchCritical] race=${alert.race_id} rate-limited — skip Telegram`,
      );
      return false;
    }

    const text = this.composeCriticalMessage(alert);

    try {
      await this.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      return true;
    } catch (err) {
      this.logger.error(
        `[dispatchCritical] Telegram send failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Compose HTML message cho Telegram. Includes BIB, name, severity, reason,
   * link tới admin UI (Phase 2 sẽ wire route thật, Phase 1C placeholder).
   */
  private composeCriticalMessage(alert: TimingAlertDocument): string {
    const lines = [
      `🔴 <b>CRITICAL Timing Alert</b>`,
      ``,
      `<b>BIB:</b> ${this.escape(alert.bib_number)}`,
      `<b>Name:</b> ${this.escape(alert.athlete_name ?? 'unknown')}`,
      `<b>Course:</b> ${this.escape(alert.contest ?? '?')} · ${this.escape(alert.age_group ?? 'no AG')}`,
      `<b>Last seen:</b> ${this.escape(alert.last_seen_point)} (${this.escape(alert.last_seen_time)})`,
      `<b>Missing:</b> ${this.escape(alert.missing_point)}`,
    ];

    if (alert.projected_finish_time) {
      lines.push(`<b>Projected finish:</b> ${this.escape(alert.projected_finish_time)}`);
    }
    if (alert.projected_age_group_rank !== null) {
      lines.push(
        `<b>Projected rank:</b> Top ${alert.projected_age_group_rank} age group / ${alert.projected_overall_rank ?? '?'} overall`,
      );
    }
    if (alert.projected_confidence !== null) {
      lines.push(
        `<b>Confidence:</b> ${Math.round((alert.projected_confidence ?? 0) * 100)}%`,
      );
    }

    lines.push(``);
    lines.push(`<i>Reason:</i> ${this.escape(alert.reason ?? '')}`);
    lines.push(``);
    lines.push(
      `Race ID: ${alert.race_id} · Detected: ${alert.first_detected_at?.toISOString() ?? '?'}`,
    );

    return lines.join('\n');
  }

  /**
   * Phase 2 — Anomaly push (mat failure / suspicious checkpoint drop).
   *
   * Triggered từ DashboardSnapshotService khi phát hiện checkpoint passedRatio
   * drop > threshold so với checkpoint trước. Channel riêng để BTC mat ops
   * team tách khỏi complaint thread.
   *
   * Rate limit: per (race, courseId, checkpointKey) 10 phút — tránh spam khi
   * mat tiếp tục down qua nhiều poll cycles.
   */
  async dispatchAnomaly(input: {
    raceId: string;
    raceTitle: string;
    courseName: string;
    checkpointKey: string;
    checkpointName: string;
    expectedCount: number;
    passedCount: number;
    previousPassedRatio: number;
    currentPassedRatio: number;
    dropPercentage: number;
  }): Promise<boolean> {
    if (!this.telegram || !this.anomalyChatId) return false;

    const acquired = await this.tryAcquireAnomalyRateLimit(
      input.raceId,
      input.courseName,
      input.checkpointKey,
    );
    if (!acquired) {
      this.logger.debug(
        `[dispatchAnomaly] race=${input.raceId} course=${input.courseName} cp=${input.checkpointKey} rate-limited`,
      );
      return false;
    }

    const text = this.composeAnomalyMessage(input);
    try {
      await this.telegram.sendMessage(this.anomalyChatId, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      this.logger.warn(
        `[dispatchAnomaly] mat failure pushed: ${input.courseName}/${input.checkpointKey} drop=${input.dropPercentage.toFixed(1)}%`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `[dispatchAnomaly] Telegram send failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private composeAnomalyMessage(input: {
    raceTitle: string;
    courseName: string;
    checkpointKey: string;
    checkpointName: string;
    expectedCount: number;
    passedCount: number;
    previousPassedRatio: number;
    currentPassedRatio: number;
    dropPercentage: number;
  }): string {
    const lines = [
      `⚠️ <b>MAT FAILURE NGHI VẤN</b>`,
      ``,
      `<b>Race:</b> ${this.escape(input.raceTitle)}`,
      `<b>Course:</b> ${this.escape(input.courseName)}`,
      `<b>Checkpoint:</b> ${this.escape(input.checkpointName)} (key: ${this.escape(input.checkpointKey)})`,
      ``,
      `<b>Số athletes passed:</b> ${input.passedCount} / ${input.expectedCount} expected`,
      `<b>Tỷ lệ passed:</b> ${(input.currentPassedRatio * 100).toFixed(1)}% (trước đó ${(input.previousPassedRatio * 100).toFixed(1)}%)`,
      `<b>Drop:</b> ${input.dropPercentage.toFixed(1)}%`,
      ``,
      `<i>Action:</i> Verify mat tại checkpoint còn hoạt động không. Có thể chip reader unplug, ăng ten lệch, hoặc athletes bị bỏ qua.`,
    ];
    return lines.join('\n');
  }

  /**
   * SETNX EX 900s — single key per race. Returns true nếu acquire OK.
   *
   * Trade-off: rate limit per RACE, không per (race, severity). Phase 2 nếu
   * cần escalate khi có alert MỚI cao hơn (HIGH → CRITICAL same race) thì
   * bypass rate limit.
   */
  private async tryAcquireRateLimit(raceId: string): Promise<boolean> {
    const key = `timing-alert:tg-rate:${raceId}`;
    const result = await this.redis.set(
      key,
      '1',
      'EX',
      NotificationDispatcherService.RATE_LIMIT_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  private async tryAcquireAnomalyRateLimit(
    raceId: string,
    courseName: string,
    checkpointKey: string,
  ): Promise<boolean> {
    const safeCourse = courseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `timing-alert:tg-anomaly:${raceId}:${safeCourse}:${checkpointKey}`;
    const result = await this.redis.set(
      key,
      '1',
      'EX',
      NotificationDispatcherService.ANOMALY_RATE_LIMIT_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  /**
   * HTML escape — Telegram parse_mode:HTML strict, untrimmed `<>&` sẽ break.
   */
  private escape(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
