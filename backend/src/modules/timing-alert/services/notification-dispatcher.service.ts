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
  private static readonly RATE_LIMIT_TTL_SECONDS = 900; // 15 phút

  constructor(@InjectRedis() private readonly redis: Redis) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId =
      env.timingAlert.telegramChatId ||
      process.env.TELEGRAM_GROUP_CHAT_ID ||
      '';

    if (token && chatId) {
      this.telegram = new Telegram(token);
      this.chatId = chatId;
      this.logger.log(
        `Timing alert Telegram enabled — chat_id=${chatId.slice(0, 4)}***`,
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
