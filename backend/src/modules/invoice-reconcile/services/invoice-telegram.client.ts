/**
 * F-076 BR-14a + BR-20 — Telegram HTTP client RIÊNG cho F-076.
 *
 * ⚠️ BOT + CHANNEL ISOLATION TUYỆT ĐỐI (Manager Adjustment #1 Option A):
 *   - Dùng bot RIÊNG `@invoice_5bib_daily_bot` (token env
 *     `INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN`)
 *   - Dùng group RIÊNG "5BIB Invoice Arlert" (chat_id env
 *     `INVOICE_RECONCILE_TELEGRAM_CHAT_ID`)
 *   - **KHÔNG** reuse `notification/telegram.service.ts` (vì service đó
 *     hardcode `process.env.TELEGRAM_BOT_TOKEN` claim bot khác hoàn toàn,
 *     PROD running)
 *   - **KHÔNG** đụng env `TELEGRAM_BOT_TOKEN` / `TELEGRAM_GROUP_CHAT_ID`
 *
 * Defense-in-depth: nếu F-076 bot token leak, claim bot vẫn safe.
 *
 * Logic:
 *   - axios POST tới `https://api.telegram.org/bot<token>/sendMessage`
 *   - HTML escape body trong composer (caller pass pre-escaped HTML)
 *   - 4096 char limit — composer tự truncate
 *   - 429 rate limit: retry 1× sau `retry_after` seconds
 *   - 403 bot kicked: throw TelegramKickedError → InvoiceAlertService fallback email
 *   - KHÔNG log raw token / chat_id (mask trong logger)
 */
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from 'src/config';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export class TelegramKickedError extends Error {
  constructor() {
    super('Telegram bot kicked from group');
    this.name = 'TelegramKickedError';
  }
}

export class TelegramSendError extends Error {
  constructor(public readonly details: string) {
    super(`Telegram send fail: ${details}`);
    this.name = 'TelegramSendError';
  }
}

interface TelegramResponse {
  ok: boolean;
  result?: { message_id: number };
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

@Injectable()
export class InvoiceTelegramClient {
  private readonly logger = new Logger(InvoiceTelegramClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 10_000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
  }

  /** Public: indicate whether F-076 Telegram env configured. */
  isConfigured(): boolean {
    const t = env.invoiceReconcile.telegram;
    return Boolean(t.botToken && t.chatId);
  }

  /** Public: chat_id masked cho health endpoint. */
  getChatIdMasked(): string | null {
    const chatId = env.invoiceReconcile.telegram.chatId;
    if (!chatId) return null;
    if (chatId.length <= 7) return '***';
    return chatId.slice(0, 4) + '***' + chatId.slice(-4);
  }

  /**
   * Send HTML message to F-076 group. Caller MUST pre-escape user-controlled
   * content (use `escapeHtml` from alert-composer).
   *
   * Returns Telegram message_id on success.
   * Throws TelegramKickedError on 403 (caller catch + fallback email).
   * Throws TelegramSendError on permanent failures.
   */
  async send(html: string): Promise<number> {
    if (!this.isConfigured()) {
      throw new TelegramSendError('Telegram bot token or chat_id not configured');
    }
    const t = env.invoiceReconcile.telegram;

    // Try once + retry on 429
    let attempt = 0;
    let retryAfter: number | undefined;
    while (attempt < 2) {
      attempt++;
      if (retryAfter && retryAfter > 0) {
        await this.sleep(Math.min(retryAfter * 1000, 30_000));
      }
      let res;
      try {
        res = await this.http.post<TelegramResponse>(
          `${TELEGRAM_API_BASE}/bot${t.botToken}/sendMessage`,
          {
            chat_id: t.chatId,
            text: html,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          },
        );
      } catch (e) {
        const msg = e instanceof AxiosError ? e.message : (e as Error).message;
        this.logger.warn(
          `[telegram] send fail chat_id=${this.getChatIdMasked()} err=${msg}`,
        );
        if (attempt >= 2) throw new TelegramSendError(`network: ${msg}`);
        continue;
      }

      const body = res.data;
      if (body && body.ok && body.result?.message_id) {
        this.logger.log(
          `[telegram] sent chat_id=${this.getChatIdMasked()} msg_id=${
            body.result.message_id
          }`,
        );
        return body.result.message_id;
      }

      // 429 rate limit
      if (
        res.status === 429 ||
        body?.error_code === 429 ||
        body?.parameters?.retry_after
      ) {
        retryAfter = body?.parameters?.retry_after ?? 1;
        this.logger.warn(
          `[telegram] rate limit, retry after ${retryAfter}s`,
        );
        continue;
      }

      // 403 bot kicked → caller fallback
      if (res.status === 403 || body?.error_code === 403) {
        this.logger.error(
          `[telegram] bot kicked from chat_id=${this.getChatIdMasked()}`,
        );
        throw new TelegramKickedError();
      }

      // Other error
      throw new TelegramSendError(
        `status=${res.status} ok=${body?.ok} code=${body?.error_code} desc=${body?.description}`,
      );
    }
    throw new TelegramSendError(
      `exhausted retries chat_id=${this.getChatIdMasked()}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
