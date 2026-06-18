import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { env } from '../../config';
import { MailService } from '../notification/mail.service';
import {
  BibPassConfig,
  BibPassConfigDocument,
} from './schemas/bib-pass-config.schema';
import { BibPassSend, BibPassSendDocument } from './schemas/bib-pass-send.schema';
import { BibPassConfigService } from './bib-pass-config.service';
import { BibPassScannerService, ConfirmedAthleteRow } from './bib-pass-scanner.service';
import { MONGO_DUP_KEY } from './bib-pass-email.constants';
import { TestSendDto } from './dto/bib-pass.dto';
import { SendBatchResultDto, TestSendResultDto } from './dto/bib-pass-response.dto';

/**
 * FEATURE-091 — orchestrate gửi Border Pass.
 *
 * - Idempotent (BR-04): "claim" mỗi VĐV bằng insert vào `bib_pass_sends` (unique
 *   {raceId, athletesId}) TRƯỚC khi gửi → E11000 = đã xử lý → skip. Optimistic:
 *   claim status='sent', downgrade 'failed' nếu render/mail lỗi (at-most-once —
 *   ưu tiên KHÔNG gửi trùng hơn là gửi đủ; phù hợp email pass).
 * - Kill-switch (BR-10): `BIB_PASS_SEND_ENABLED=false` → batch/cron CHỈ dry-run
 *   (đếm, KHÔNG ghi ledger, KHÔNG gửi). Test-send là hành động thủ công admin →
 *   gửi cho email admin chỉ định (KHÔNG phải VĐV), nên KHÔNG chịu kill-switch
 *   batch — chỉ cần Mailchimp cấu hình.
 * - Throttle (BR-11): mỗi lần xử lý tối đa `BIB_PASS_BATCH_LIMIT`.
 */
@Injectable()
export class BibPassSenderService {
  private readonly logger = new Logger(BibPassSenderService.name);

  constructor(
    @InjectModel(BibPassSend.name)
    private readonly sendModel: Model<BibPassSendDocument>,
    private readonly configService: BibPassConfigService,
    private readonly scanner: BibPassScannerService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Gửi pass cho các VĐV đã xác nhận CHƯA gửi (anti-join ledger), tối đa
   * `limit` (default env BATCH_LIMIT). Dùng bởi cron + nút "Gửi" admin.
   */
  async sendBatch(
    raceId: number,
    opts: { limit?: number } = {},
  ): Promise<SendBatchResultDto> {
    const config = await this.configService.getConfigDoc(raceId); // 404 nếu chưa cấu hình
    const limit = Math.max(1, opts.limit ?? env.bibPass.batchLimit);

    // anti-join: athletesId đã có trong ledger (mọi trạng thái) → bỏ qua.
    const ledger = await this.sendModel
      .find({ raceId })
      .select('athletesId')
      .lean()
      .exec();
    const claimed = new Set<number>(ledger.map((d) => d.athletesId));

    const confirmed = await this.scanner.findConfirmed(raceId);
    const pending = confirmed.filter((r) => !claimed.has(r.athletes_id));
    const batch = pending.slice(0, limit);
    const hasMore = pending.length > batch.length;

    // BR-10 kill-switch — dry-run khi tắt: KHÔNG ghi ledger, KHÔNG gửi.
    if (!env.bibPass.sendEnabled) {
      this.logger.warn(
        `[batch] BIB_PASS_SEND_ENABLED=false — DRY-RUN race=${raceId} would-send=${batch.length} pending=${pending.length}`,
      );
      return {
        attempted: batch.length,
        sent: 0,
        failed: 0,
        skipped: batch.length,
        dryRun: true,
        hasMore,
      };
    }
    // BR-09 — phải bật enabled mới gửi batch thật.
    if (!config.enabled) {
      throw new BadRequestException('Cấu hình đang TẮT — bật "Kích hoạt gửi" trước');
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const row of batch) {
      const result = await this.processOne(config, row);
      if (result === 'sent') sent++;
      else if (result === 'skipped') skipped++;
      else failed++;
    }
    this.logger.log(
      `[batch] race=${raceId} attempted=${batch.length} sent=${sent} failed=${failed} skipped=${skipped} hasMore=${hasMore}`,
    );
    return {
      attempted: batch.length,
      sent,
      failed,
      skipped,
      dryRun: false,
      hasMore,
    };
  }

  /** Xử lý 1 VĐV: claim ledger → render → gửi. Trả trạng thái. */
  private async processOne(
    config: BibPassConfigDocument,
    row: ConfirmedAthleteRow,
  ): Promise<'sent' | 'failed' | 'skipped'> {
    // 1. claim (idempotency). Trùng = đã xử lý → skip.
    let claimId: unknown;
    try {
      const claim = await this.sendModel.create({
        raceId: row.race_id,
        athletesId: row.athletes_id,
        bib: row.bib_number ?? '',
        email: row.email ?? '',
        status: 'sent',
      });
      claimId = claim._id;
    } catch (err) {
      if (this.isDupKey(err)) return 'skipped';
      throw err;
    }

    // 2. BR-13 — không có email → failed 'no_email'.
    if (!row.email) {
      await this.markFailed(claimId, 'no_email');
      return 'failed';
    }

    // 3. render + gửi.
    try {
      const png = await this.configService.renderForRow(config, row);
      const html = this.interpolate(this.bodyOrDefault(config), row, config);
      const subject = this.interpolate(
        config.email?.subject || '[5BIB] Border Pass của bạn',
        row,
        config,
      );
      const ok = await this.mailService.sendBibPass({
        toEmail: row.email,
        subject,
        html,
        png,
        filename: this.filename(config, row),
        fromName: config.email?.fromName || '5BIB',
      });
      if (!ok) {
        await this.markFailed(claimId, 'mail_error');
        return 'failed';
      }
      return 'sent';
    } catch (err) {
      this.logger.error(
        `[batch] render/send failed athletes_id=${row.athletes_id}: ${(err as Error).message}`,
      );
      await this.markFailed(claimId, 'render_error');
      return 'failed';
    }
  }

  /**
   * Gửi thử 1 email cho địa chỉ admin chỉ định (KHÔNG ghi ledger, KHÔNG gửi VĐV
   * thật). Nếu `athletesId` → render dữ liệu thật; ngược lại dùng dữ liệu mẫu.
   */
  async testSend(raceId: number, dto: TestSendDto): Promise<TestSendResultDto> {
    const config = await this.configService.getConfigDoc(raceId);
    if (!config.template) {
      throw new BadRequestException('Chưa cấu hình phôi');
    }
    let row: ConfirmedAthleteRow;
    if (dto.athletesId) {
      const found = await this.scanner.findConfirmedOne(raceId, dto.athletesId);
      if (!found) {
        throw new BadRequestException('VĐV không tồn tại hoặc chưa xác nhận BIB');
      }
      row = found;
    } else {
      row = {
        athletes_id: 0,
        race_id: raceId,
        name: 'NGUYỄN THỊ HẬU',
        bib_number: '1234',
        email: dto.toEmail,
        club: 'CLB Chạy Bộ Sa Pa',
        name_on_bib: 'Nguyễn Thị Hậu',
      };
    }

    const png = await this.configService.renderForRow(config, row);
    const html = this.interpolate(this.bodyOrDefault(config), row, config);
    const subject =
      '[TEST] ' +
      this.interpolate(config.email?.subject || '[5BIB] Border Pass của bạn', row, config);
    const ok = await this.mailService.sendBibPass({
      toEmail: dto.toEmail,
      subject,
      html,
      png,
      filename: this.filename(config, row),
      fromName: config.email?.fromName || '5BIB',
    });
    return ok
      ? { ok: true, message: `Đã gửi email thử tới ${dto.toEmail}` }
      : {
          ok: false,
          message:
            'Chưa gửi được — Mailchimp chưa cấu hình (MAILCHIMP_API_KEY) trên môi trường này',
        };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * Downgrade claim 'sent' → 'failed' (best-effort). Bọc try/catch: nếu Mongo
   * lỗi lúc downgrade, KHÔNG throw ra processOne (đã trả 'failed' đúng) — chỉ
   * log để biết ledger có thể còn 'sent' lệch (at-most-once: VĐV bỏ lỡ pass,
   * KHÔNG gửi trùng). Tránh inconsistency âm thầm.
   */
  private async markFailed(claimId: unknown, reason: string): Promise<void> {
    try {
      await this.sendModel
        .updateOne({ _id: claimId }, { status: 'failed', failReason: reason })
        .exec();
    } catch (err) {
      this.logger.error(
        `[batch] markFailed downgrade lỗi (ledger có thể còn 'sent' lệch) id=${String(claimId)} reason=${reason}: ${(err as Error).message}`,
      );
    }
  }

  private bodyOrDefault(config: BibPassConfigDocument): string {
    const body = config.email?.bodyHtml?.trim();
    if (body) return body;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color:#1d4ed8;">Chào {name},</h2>
        <p>Đây là Border Pass của bạn cho sự kiện <strong>{event_name}</strong>.</p>
        <p>Số BIB: <strong>{bib}</strong></p>
        <p>Vui lòng xem ảnh đính kèm. Hẹn gặp bạn tại vạch xuất phát!</p>
      </div>`;
  }

  /** Interpolate token email/filename (cùng tập token render). */
  private interpolate(
    text: string,
    row: ConfirmedAthleteRow,
    config: BibPassConfigDocument,
  ): string {
    const data = this.configService.buildRenderData(row, config);
    const vars = data.variables ?? {};
    let out = text;
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${this.escape(k)}\\}`, 'g'), String(v ?? ''));
    }
    return out;
  }

  private filename(config: BibPassConfigDocument, row: ConfirmedAthleteRow): string {
    const raw = this.interpolate(
      config.attachmentFilename || 'border-pass-{bib}.png',
      row,
      config,
    );
    // sanitize: chỉ giữ ký tự an toàn cho tên file.
    const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return safe.endsWith('.png') ? safe : `${safe}.png`;
  }

  private escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isDupKey(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === MONGO_DUP_KEY
    );
  }
}
