import { Injectable, Logger } from '@nestjs/common';
import { Telegram } from 'telegraf';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private telegram: Telegram | null = null;
  private chatId: string | null = null;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;

    if (token && chatId) {
      this.telegram = new Telegram(token);
      this.chatId = chatId;
      this.logger.log('Telegram notification enabled');
    } else {
      this.logger.warn(
        'Telegram notification disabled — missing TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID',
      );
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.telegram || !this.chatId) return;

    try {
      await this.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      this.logger.error(`Failed to send Telegram message: ${err.message}`);
    }
  }

  async notifyClaimSubmitted(claim: {
    bib: string;
    name: string;
    phone?: string;
    email?: string;
    description: string;
    raceId?: string;
    courseId?: string;
  }): Promise<void> {
    const lines = [
      `🆕 <b>Khiếu nại mới</b>`,
      '',
      `👤 <b>${claim.name}</b> (BIB: ${claim.bib})`,
    ];

    if (claim.phone) lines.push(`📱 ${claim.phone}`);
    if (claim.email) lines.push(`📧 ${claim.email}`);
    lines.push(`📝 ${claim.description}`);

    await this.sendMessage(lines.join('\n'));
  }

  async notifyClaimResolved(claim: {
    bib: string;
    name: string;
    phone?: string;
    description: string;
    status: string;
    adminNote?: string;
    raceId?: string;
    courseId?: string;
  }): Promise<void> {
    const statusEmoji = claim.status === 'resolved' ? '✅' : '❌';
    const statusText = claim.status === 'resolved' ? 'Đã xử lý' : 'Từ chối';

    const lines = [
      `${statusEmoji} <b>Khiếu nại ${statusText}</b>`,
      '',
      `👤 <b>${claim.name}</b> (BIB: ${claim.bib})`,
    ];

    if (claim.phone) lines.push(`📱 ${claim.phone}`);
    lines.push(`📝 ${claim.description}`);
    if (claim.adminNote) lines.push(`💬 Admin: ${claim.adminNote}`);

    await this.sendMessage(lines.join('\n'));
  }
}
