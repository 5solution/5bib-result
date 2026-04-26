import { Injectable, Logger } from '@nestjs/common';
import { env } from 'src/config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mailchimp = require('@mailchimp/mailchimp_transactional');

export interface AvatarOtpEmailData {
  toEmail: string;
  name: string;
  bib: string;
  otp: string;
}

export interface ClaimResolvedEmailData {
  toEmail: string;
  registeredName: string;
  bib: string;
  phone: string;
  reason: string;
  adminNote: string;
  eventTitle: string;
}

export interface TeamRegistrationApprovedData {
  toEmail: string;
  fullName: string;
  eventName: string;
  roleName: string;
  magicLink: string;
  /** base64 data-URL (image/png) of the QR code. */
  qrDataUrl: string;
}

export interface TeamWaitlistedData {
  toEmail: string;
  fullName: string;
  eventName: string;
  roleName: string;
  waitlistPosition: number;
  magicLink: string;
}

export interface TeamContractSentData {
  toEmail: string;
  fullName: string;
  eventName: string;
  roleName: string;
  magicLink: string;
}

export interface TeamContractSignedData {
  toEmail: string;
  fullName: string;
  eventName: string;
  roleName: string;
  totalCompensation: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export interface TeamReminderT3Data {
  toEmail: string;
  fullName: string;
  eventName: string;
  roleName: string;
  eventStartDate: string;
  eventLocation: string;
  magicLink: string;
}

export interface TeamCancelledData {
  toEmail: string;
  fullName: string;
  eventName: string;
  roleName: string;
  reason?: string;
}

export interface TeamAcceptanceSentData {
  toEmail: string;
  fullName: string;
  eventName: string;
  contractNumber: string;
  /** Pre-formatted "1.234.567" VND string. */
  acceptanceValue: string;
  magicLink: string;
}

export interface TeamAcceptanceSignedData {
  toEmail: string;
  fullName: string;
  eventName: string;
  contractNumber: string;
  acceptanceValue: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export interface TeamPaymentCompletedData {
  toEmail: string;
  fullName: string;
  eventName: string;
  contractNumber: string;
  acceptanceValue: string;
}

export interface TimingLeadNotificationData {
  toEmails: string[];
  lead_number: number;
  full_name: string;
  phone: string;
  organization: string;
  athlete_count_range: string;
  package_interest: string;
  notes: string;
  adminUrl: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client;

  constructor() {
    if (env.mailchimp.apiKey) {
      this.client = mailchimp(env.mailchimp.apiKey);
    } else {
      this.logger.warn('MAILCHIMP_API_KEY not set — email sending disabled');
    }
  }

  async ping(): Promise<string> {
    if (!this.client) return 'Mailchimp not configured';
    const response = await this.client.users.ping();
    this.logger.log(`Mailchimp ping: ${JSON.stringify(response)}`);
    return response;
  }

  async sendAvatarOtpEmail(data: AvatarOtpEmailData) {
    if (!this.client) {
      this.logger.warn(`[DEV] Avatar OTP for BIB ${data.bib}: ${data.otp}`);
      return;
    }

    try {
      await this.client.messages.sendTemplate({
        template_name: 'sendavatarotpemail',
        template_content: [],
        message: {
          from_email: 'info@5bib.com',
          from_name: '5BIB',
          subject: `[5BIB] Mã xác thực đổi ảnh đại diện - Bib ${data.bib}`,
          to: [{ email: data.toEmail, type: 'to' }],
          global_merge_vars: [
            { name: 'name', content: data.name },
            { name: 'bib', content: data.bib },
            { name: 'otp', content: data.otp },
          ],
        },
      });
      this.logger.log(`Avatar OTP email sent to ${data.toEmail} (BIB: ${data.bib})`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email: ${error.message}`);
    }
  }

  async sendClaimResolvedEmail(data: ClaimResolvedEmailData) {
    if (!this.client) {
      this.logger.warn('Mailchimp not configured, skipping email');
      return;
    }

    const subject = `[5BIB] Kết quả xử lý khiếu nại số Bib ${data.bib} - ${data.eventTitle}`;

    const mergeVars = [
      { name: 'registered_name', content: data.registeredName },
      { name: 'bib', content: data.bib },
      { name: 'phone', content: data.phone },
      { name: 'reason', content: data.reason },
      { name: '5bibNote', content: data.adminNote || '' },
      { name: 'event_title', content: data.eventTitle },
    ];

    try {
      const response = await this.client.messages.sendTemplate({
        template_name: 'timingEmail',
        template_content: [],
        message: {
          from_email: 'info@5bib.com',
          from_name: '5BIB Customer Support',
          subject,
          to: [{ email: data.toEmail, type: 'to' }],
          global_merge_vars: mergeVars,
        },
      });

      this.logger.log(
        `Claim resolved email sent to ${data.toEmail} (BIB: ${data.bib})`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to send claim email to ${data.toEmail}: ${error.message}`,
      );
      // Don't re-throw — fire and forget
    }
  }

  async sendTeamRegistrationApproved(
    data: TeamRegistrationApprovedData,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Team approved: ${data.fullName} (${data.roleName}) → ${data.magicLink}`,
      );
      return;
    }
    const subject = `[5BIB Crew] - Đăng ký thành công - ${data.eventName}`;
    const base64 = data.qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #1d4ed8;">Chào ${escapeHtml(data.fullName)},</h2>
        <p>Bạn đã đăng ký thành công vai trò <strong>${escapeHtml(data.roleName)}</strong> cho sự kiện <strong>${escapeHtml(data.eventName)}</strong>.</p>
        <p>Vui lòng giữ mã QR dưới đây để check-in ngày vận hành:</p>
        <p style="text-align:center;"><img src="cid:qr-code" alt="QR" width="220" height="220" style="border-radius:8px;" /></p>
        <p>Hoặc truy cập trang trạng thái cá nhân: <a href="${data.magicLink}">${data.magicLink}</a></p>
        <p style="color:#78716c; font-size:12px;">Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
          images: [
            { type: 'image/png', name: 'qr-code', content: base64 },
          ],
        },
      });
      this.logger.log(`Team approved email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send team approved email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamContractSent(data: TeamContractSentData): Promise<void> {
    if (!this.client) {
      this.logger.warn(`[DEV] Contract sent: ${data.fullName} → ${data.magicLink}`);
      return;
    }
    const subject = `[5BIB Crew] - Hợp đồng cộng tác - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #1d4ed8;">Chào ${escapeHtml(data.fullName)},</h2>
        <p>Ban tổ chức <strong>${escapeHtml(data.eventName)}</strong> đã gửi hợp đồng cộng tác cho vai trò <strong>${escapeHtml(data.roleName)}</strong>.</p>
        <p>Vui lòng xem và xác nhận tại liên kết dưới:</p>
        <p style="text-align:center;">
          <a href="${data.magicLink.replace('/status/', '/contract/')}"
             style="display:inline-block; background:#1d4ed8; color:white; padding:12px 22px; border-radius:8px; text-decoration:none; font-weight:600;">
            Xem và ký hợp đồng
          </a>
        </p>
        <p style="color:#78716c; font-size:12px;">Liên kết này chỉ sử dụng được một lần. Sau khi ký, bạn sẽ nhận bản PDF qua email.</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Team contract-sent email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed contract-sent email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamContractSigned(data: TeamContractSignedData): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Contract signed: ${data.fullName} total=${data.totalCompensation}`,
      );
      return;
    }
    const subject = `[5BIB Crew] - Xác nhận ký hợp đồng - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #166534;">Đã ký hợp đồng thành công</h2>
        <p>Chào ${escapeHtml(data.fullName)},</p>
        <p>Hợp đồng cộng tác vai trò <strong>${escapeHtml(data.roleName)}</strong> cho sự kiện <strong>${escapeHtml(data.eventName)}</strong> đã được ký thành công.</p>
        <p>Tổng thù lao dự kiến: <strong>${escapeHtml(data.totalCompensation)} VNĐ</strong></p>
        <p>Bản PDF được đính kèm trong email này.</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
          attachments: [
            {
              type: 'application/pdf',
              name: data.pdfFilename,
              content: data.pdfBuffer.toString('base64'),
            },
          ],
        },
      });
      this.logger.log(`Team contract-signed email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed contract-signed email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamReminderT3(data: TeamReminderT3Data): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Reminder T-3: ${data.fullName} event=${data.eventName} start=${data.eventStartDate}`,
      );
      return;
    }
    const subject = `[5BIB Crew] - Nhắc nhở sự kiện - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #ea580c;">Chào ${escapeHtml(data.fullName)},</h2>
        <p>Sự kiện <strong>${escapeHtml(data.eventName)}</strong> sẽ diễn ra sau 3 ngày.</p>
        <ul>
          <li><strong>Ngày:</strong> ${escapeHtml(data.eventStartDate)}</li>
          <li><strong>Địa điểm:</strong> ${escapeHtml(data.eventLocation || 'Xem trên trang sự kiện')}</li>
          <li><strong>Vai trò của bạn:</strong> ${escapeHtml(data.roleName)}</li>
        </ul>
        <p>Xem mã QR check-in tại: <a href="${data.magicLink}">${data.magicLink}</a></p>
        <p style="color:#78716c; font-size:12px;">Vui lòng mang theo CCCD gốc để đối chiếu khi check-in.</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Team reminder-T3 email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed reminder email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamCancelled(data: TeamCancelledData): Promise<void> {
    if (!this.client) {
      this.logger.warn(`[DEV] Cancelled: ${data.fullName} event=${data.eventName}`);
      return;
    }
    const subject = `[5BIB Crew] - Hủy đăng ký - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2>Chào ${escapeHtml(data.fullName)},</h2>
        <p>Ban tổ chức đã hủy đăng ký của bạn cho vai trò <strong>${escapeHtml(data.roleName)}</strong> tại <strong>${escapeHtml(data.eventName)}</strong>.</p>
        ${
          data.reason
            ? `<p><strong>Lý do:</strong> ${escapeHtml(data.reason)}</p>`
            : ''
        }
        <p>Cảm ơn bạn đã quan tâm tham gia. Hẹn gặp ở các sự kiện sau!</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Team cancelled email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed cancelled email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Send an arbitrary admin-authored HTML body. Used by v1.4 Team Schedule
   * Email (one-off blasts per role) — caller is responsible for server-side
   * sanitization before calling this. Returns true on successful queue;
   * false when Mailchimp is not configured (dev) or the send errored (the
   * error is logged but not thrown — bulk sends log per-failure and keep
   * going).
   */
  async sendCustomHtml(
    toEmail: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] sendCustomHtml to=${toEmail} subject="${subject}" (mailchimp not configured)`,
      );
      return false;
    }
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Custom HTML email sent to ${toEmail}`);
      return true;
    } catch (error) {
      this.logger.error(
        `sendCustomHtml failed to=${toEmail}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async sendTeamAcceptanceSent(data: TeamAcceptanceSentData): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Acceptance sent: ${data.fullName} contract=${data.contractNumber} value=${data.acceptanceValue} → ${data.magicLink}`,
      );
      return;
    }
    const subject = `[5BIB Crew] - Biên bản nghiệm thu - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #1d4ed8;">Chào ${escapeHtml(data.fullName)},</h2>
        <p>Ban tổ chức <strong>${escapeHtml(data.eventName)}</strong> đã gửi biên bản nghiệm thu cho hợp đồng <strong>${escapeHtml(data.contractNumber)}</strong>.</p>
        <p>Tổng giá trị nghiệm thu: <strong>${escapeHtml(data.acceptanceValue)} VNĐ</strong> <span style="color:#78716c; font-size:11px;">(đã bao gồm thuế TNCN)</span></p>
        <p>Vui lòng xem và ký xác nhận tại liên kết dưới. Sau khi bạn ký, ban tổ chức sẽ xử lý thanh toán trong 3–5 ngày làm việc.</p>
        <p style="text-align:center;">
          <a href="${data.magicLink}"
             style="display:inline-block; background:#1d4ed8; color:white; padding:12px 22px; border-radius:8px; text-decoration:none; font-weight:600;">
            Xem và ký biên bản
          </a>
        </p>
        <p style="color:#78716c; font-size:12px;">Nếu có sai sót (số tiền, số ngày công, thông tin tài khoản), vui lòng liên hệ admin trước khi ký.</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Team acceptance-sent email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed acceptance-sent email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamAcceptanceSigned(
    data: TeamAcceptanceSignedData,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Acceptance signed: ${data.fullName} contract=${data.contractNumber} value=${data.acceptanceValue}`,
      );
      return;
    }
    const subject = `[5BIB Crew] - Xác nhận biên bản nghiệm thu - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #166534;">Đã ký biên bản nghiệm thu</h2>
        <p>Chào ${escapeHtml(data.fullName)},</p>
        <p>Biên bản nghiệm thu cho hợp đồng <strong>${escapeHtml(data.contractNumber)}</strong> — sự kiện <strong>${escapeHtml(data.eventName)}</strong> — đã được ký thành công.</p>
        <p>Tổng giá trị nghiệm thu: <strong>${escapeHtml(data.acceptanceValue)} VNĐ</strong></p>
        <p>Ban tổ chức sẽ tiến hành thanh toán trong 3–5 ngày làm việc. Bản PDF được đính kèm trong email này.</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
          attachments: [
            {
              type: 'application/pdf',
              name: data.pdfFilename,
              content: data.pdfBuffer.toString('base64'),
            },
          ],
        },
      });
      this.logger.log(`Team acceptance-signed email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed acceptance-signed email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamPaymentCompleted(
    data: TeamPaymentCompletedData,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Payment completed: ${data.fullName} contract=${data.contractNumber} value=${data.acceptanceValue}`,
      );
      return;
    }
    // Event name is optional in the payload — the payment service emits
    // this without loading the event relation. Fallback to contract number
    // in the subject so the email is still intelligible.
    const eventLabel = data.eventName || data.contractNumber || 'sự kiện';
    const subject = `[5BIB Crew] - Thanh toán đã hoàn tất - ${eventLabel}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #166534;">Thanh toán đã hoàn tất</h2>
        <p>Chào ${escapeHtml(data.fullName)},</p>
        <p>Ban tổ chức đã chuyển khoản <strong>${escapeHtml(data.acceptanceValue)} VNĐ</strong> cho hợp đồng <strong>${escapeHtml(data.contractNumber)}</strong>${
          data.eventName ? ` — sự kiện <strong>${escapeHtml(data.eventName)}</strong>` : ''
        }.</p>
        <p>Vui lòng kiểm tra tài khoản ngân hàng. Nếu sau 24h chưa nhận được, liên hệ admin để xử lý.</p>
        <p style="color:#78716c; font-size:12px;">Cảm ơn bạn đã đồng hành cùng 5BIB!</p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Team payment-completed email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed payment-completed email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }

  async sendTimingLeadNotification(
    data: TimingLeadNotificationData,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Timing lead #${data.lead_number} from ${data.full_name} (${data.phone}) @ ${data.organization}`,
      );
      return;
    }
    const subject = `[5BIB Timing] Lead #${data.lead_number} — ${data.organization}`;
    const pkgLabel: Record<string, string> = {
      basic: 'Basic',
      advanced: 'Advanced',
      professional: 'Professional',
      unspecified: 'Chưa xác định',
    };
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #1d4ed8;">🏁 Lead mới từ timing.5bib.com</h2>
        <p><strong>Số lead:</strong> #${data.lead_number}</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:6px 0; color:#78716c; width:140px;">Họ tên</td><td><strong>${escapeHtml(data.full_name)}</strong></td></tr>
          <tr><td style="padding:6px 0; color:#78716c;">SĐT</td><td><a href="tel:${escapeHtml(data.phone)}"><strong>${escapeHtml(data.phone)}</strong></a></td></tr>
          <tr><td style="padding:6px 0; color:#78716c;">Tổ chức</td><td>${escapeHtml(data.organization)}</td></tr>
          <tr><td style="padding:6px 0; color:#78716c;">Quy mô</td><td>${escapeHtml(data.athlete_count_range || '-')}</td></tr>
          <tr><td style="padding:6px 0; color:#78716c;">Gói</td><td>${escapeHtml(pkgLabel[data.package_interest] || data.package_interest)}</td></tr>
        </table>
        ${
          data.notes
            ? `<div style="margin:16px 0;"><div style="color:#78716c; font-size:12px; margin-bottom:4px;">Ghi chú</div><div style="background:#fafaf9; padding:12px; border-radius:8px; white-space:pre-wrap;">${escapeHtml(data.notes)}</div></div>`
            : ''
        }
        <p style="text-align:center; margin: 24px 0;">
          <a href="${data.adminUrl}"
             style="display:inline-block; background:#1d4ed8; color:white; padding:12px 22px; border-radius:8px; text-decoration:none; font-weight:600;">
            Mở lead trong admin →
          </a>
        </p>
        <p style="color:#78716c; font-size:12px;">Email này được gửi tự động khi có yêu cầu báo giá mới.</p>
      </div>
    `;
    const recipients = data.toEmails.map((email) => ({ email, type: 'to' as const }));
    try {
      await this.client.messages.send({
        message: {
          from_email: 'info@5bib.com',
          from_name: '5BIB Timing',
          subject,
          html,
          to: recipients,
        },
      });
      this.logger.log(
        `Timing lead notification sent to ${data.toEmails.join(', ')} (lead #${data.lead_number})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed timing lead notification for #${data.lead_number}: ${(error as Error).message}`,
      );
    }
  }

  async sendTeamWaitlisted(data: TeamWaitlistedData): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Team waitlisted: ${data.fullName} pos=${data.waitlistPosition}`,
      );
      return;
    }
    const subject = `[5BIB Crew] - Danh sách chờ - ${data.eventName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #ea580c;">Chào ${escapeHtml(data.fullName)},</h2>
        <p>Vị trí <strong>${escapeHtml(data.roleName)}</strong> trong sự kiện <strong>${escapeHtml(data.eventName)}</strong> đã đủ slot. Bạn đang ở danh sách chờ ở vị trí <strong>#${data.waitlistPosition}</strong>.</p>
        <p>Chúng tôi sẽ tự động email cho bạn khi có slot mở ra.</p>
        <p>Theo dõi trạng thái tại: <a href="${data.magicLink}">${data.magicLink}</a></p>
      </div>
    `;
    try {
      await this.client.messages.send({
        message: {
          from_email: env.teamManagement.emailFrom,
          from_name: '5BIB - Crew Notifications',
          subject,
          html,
          to: [{ email: data.toEmail, type: 'to' }],
        },
      });
      this.logger.log(`Team waitlisted email sent to ${data.toEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send waitlisted email to ${data.toEmail}: ${(error as Error).message}`,
      );
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
