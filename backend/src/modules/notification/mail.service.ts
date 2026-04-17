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
    const subject = `Đăng ký thành công — ${data.eventName}`;
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
          from_name: '5BIB Team',
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
    const subject = `Hợp đồng cộng tác — ${data.eventName}`;
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
          from_name: '5BIB Team',
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
    const subject = `Xác nhận ký hợp đồng — ${data.eventName}`;
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
          from_name: '5BIB Team',
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
    const subject = `Nhắc nhở sự kiện ${data.eventName} — còn 3 ngày`;
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
          from_name: '5BIB Team',
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
    const subject = `Hủy đăng ký — ${data.eventName}`;
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
          from_name: '5BIB Team',
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

  async sendTeamWaitlisted(data: TeamWaitlistedData): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `[DEV] Team waitlisted: ${data.fullName} pos=${data.waitlistPosition}`,
      );
      return;
    }
    const subject = `Danh sách chờ — ${data.eventName}`;
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
          from_name: '5BIB Team',
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
