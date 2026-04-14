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
        template_name: 'sendAvatarOtpEmail',
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
}
