/**
 * F-076 TC-23a..e — Telegram client (BOT RIÊNG F-076) tests.
 *
 * Mock axios via jest.mock — verify:
 *  - happy path body params
 *  - 429 rate limit retry
 *  - 403 bot kicked throw
 *  - graceful fail when not configured
 */
import axios from 'axios';
import {
  InvoiceTelegramClient,
  TelegramKickedError,
  TelegramSendError,
} from '../services/invoice-telegram.client';
import { env } from 'src/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InvoiceTelegramClient', () => {
  let client: InvoiceTelegramClient;
  let mockPost: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost = jest.fn();
    mockedAxios.create.mockReturnValue({ post: mockPost } as any);
    client = new InvoiceTelegramClient();
  });

  describe('isConfigured + getChatIdMasked', () => {
    it('returns false when token unset', () => {
      const orig = { ...env.invoiceReconcile.telegram };
      env.invoiceReconcile.telegram.botToken = '';
      env.invoiceReconcile.telegram.chatId = '';
      expect(client.isConfigured()).toBe(false);
      expect(client.getChatIdMasked()).toBeNull();
      env.invoiceReconcile.telegram.botToken = orig.botToken;
      env.invoiceReconcile.telegram.chatId = orig.chatId;
    });

    it('masks chat_id for display', () => {
      const orig = env.invoiceReconcile.telegram.chatId;
      env.invoiceReconcile.telegram.chatId = '-1003743947167';
      expect(client.getChatIdMasked()).toBe('-100***7167');
      env.invoiceReconcile.telegram.chatId = orig;
    });
  });

  describe('send (TC-23a happy path)', () => {
    beforeEach(() => {
      env.invoiceReconcile.telegram.botToken = '12345:ABC';
      env.invoiceReconcile.telegram.chatId = '-1003743947167';
    });

    it('TC-23a: sends with correct body params and returns message_id', async () => {
      mockPost.mockResolvedValue({
        status: 200,
        data: { ok: true, result: { message_id: 42 } },
      });
      const msgId = await client.send('<b>test</b>');
      expect(msgId).toBe(42);
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/bot12345:ABC/sendMessage'),
        expect.objectContaining({
          chat_id: '-1003743947167',
          text: '<b>test</b>',
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      );
    });

    // TC-23d — 429 rate limit
    it('TC-23d: retries 1× after 429 retry_after', async () => {
      mockPost
        .mockResolvedValueOnce({
          status: 200,
          data: {
            ok: false,
            error_code: 429,
            parameters: { retry_after: 0 },
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { ok: true, result: { message_id: 7 } },
        });
      const msgId = await client.send('<b>x</b>');
      expect(msgId).toBe(7);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    // TC-23e — 403 bot kicked
    it('TC-23e: throws TelegramKickedError on 403', async () => {
      mockPost.mockResolvedValue({
        status: 403,
        data: { ok: false, error_code: 403, description: 'bot kicked' },
      });
      await expect(client.send('<b>x</b>')).rejects.toThrow(
        TelegramKickedError,
      );
    });

    it('throws TelegramSendError when not configured', async () => {
      env.invoiceReconcile.telegram.botToken = '';
      await expect(client.send('hi')).rejects.toThrow(TelegramSendError);
    });

    it('throws TelegramSendError on unknown status', async () => {
      mockPost.mockResolvedValue({
        status: 500,
        data: { ok: false, error_code: 500, description: 'server error' },
      });
      await expect(client.send('<b>x</b>')).rejects.toThrow(TelegramSendError);
    });
  });
});
