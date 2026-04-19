import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { In, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { env } from '../../../config';
import {
  RegistrationStatus,
  VolRegistration,
} from '../entities/vol-registration.entity';
import {
  RecoveredRegistrationDto,
  VerifyRecoverOtpResponseDto,
} from '../dto/recover.dto';
import { MailService } from '../../notification/mail.service';

// OTP lifetime — short enough that a leaked email-forwarding relay can't
// replay it the next day, long enough that a TNV on slow SMTP still catches
// it. 10 minutes matches industry norm (Google, GitHub).
const OTP_TTL_SECONDS = 600;

// Per-OTP attempt ceiling — 5 wrong submissions, then we burn the OTP and the
// user must re-request. 6 digits ⇒ 10⁶ combinations, 5 attempts ⇒ 5×10⁻⁶
// blind-guess probability ≈ 0.0005%.
const MAX_OTP_ATTEMPTS = 5;

// Rate-limit windows — 1 hour rolling. If a TNV spams the Request button
// past MAX_PER_EMAIL, block. If an IP spams across multiple emails past
// MAX_PER_IP, block. Both apply.
const RL_WINDOW_SECONDS = 3600;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

// Statuses that are still "active" — TNV might legitimately want to log back
// in to check contract / check-in / update profile. Terminal states hide the
// registration from recovery so a cancelled TNV can't grab their old magic
// link and self-undo the cancellation.
const ACTIVE_STATUSES: RegistrationStatus[] = [
  'pending_approval',
  'approved',
  'contract_sent',
  'contract_signed',
  'qr_sent',
  'checked_in',
  'completed',
  'waitlisted',
];

interface StoredOtp {
  otp: string;
  attempts: number;
}

@Injectable()
export class TeamRecoverService {
  private readonly logger = new Logger(TeamRecoverService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    private readonly mail: MailService,
  ) {}

  // -------- Step 1: request OTP --------

  async requestOtp(
    rawEmail: string,
    ip: string,
    turnstileToken: string,
  ): Promise<{ ok: true; sent_to: string }> {
    const email = rawEmail.trim().toLowerCase();
    const masked = maskEmail(email);

    // 1. CAPTCHA — verified FIRST so a bot can't waste our rate-limit slots
    //    or our SMTP budget. In dev (no secret configured) we skip.
    if (env.turnstile.secretKey) {
      const captchaOk = await this.verifyTurnstile(turnstileToken, ip);
      if (!captchaOk) {
        this.logger.warn(`RECOVER_CAPTCHA_FAIL ip=${ip} email=${masked}`);
        throw new BadRequestException('Captcha không hợp lệ. Thử lại.');
      }
    }

    // 2. Rate limit BOTH by email and by IP. Email first because the attacker
    //    is usually targeting a specific TNV; IP catches enumeration sprays.
    await this.checkAndBumpRateLimit(
      `recover:rl:email:${email}`,
      MAX_PER_EMAIL,
      'email',
      masked,
    );
    await this.checkAndBumpRateLimit(
      `recover:rl:ip:${ip}`,
      MAX_PER_IP,
      'ip',
      ip,
    );

    // 3. Lookup — at least one active registration must exist. We still
    //    return 200 even if none found (anti-enumeration), but we skip the
    //    email send and log it.
    const regs = await this.regRepo.find({
      where: { email, status: In(ACTIVE_STATUSES) },
      relations: { event: true, role: true },
      order: { created_at: 'DESC' },
    });

    if (regs.length === 0) {
      this.logger.log(
        `RECOVER_REQUEST_NO_MATCH email=${masked} ip=${ip} — responded 200 (anti-enumeration)`,
      );
      // Silent success — don't leak existence.
      return { ok: true, sent_to: masked };
    }

    // 4. Generate 6-digit OTP. Use crypto.randomInt for uniform distribution —
    //    Math.random is NOT cryptographically secure.
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');

    // 5. Store in Redis. Overwrites any previous unconsumed OTP (attempts
    //    counter resets) — legitimate case: user requested, lost email,
    //    requested again.
    const payload: StoredOtp = { otp, attempts: 0 };
    await this.redis.set(
      `recover:otp:${email}`,
      JSON.stringify(payload),
      'EX',
      OTP_TTL_SECONDS,
    );

    // 6. Send email. fire-and-forget — UI already returned 200. If SMTP
    //    flakes the user can request again (rate-limit permitting).
    const subject = `[5BIB] Mã khôi phục link portal (${otp})`;
    const eventNames = Array.from(
      new Set(regs.map((r) => r.event?.event_name).filter(Boolean)),
    ).join(', ');
    const html = buildOtpEmailHtml({
      otp,
      eventNames,
      ttlMinutes: OTP_TTL_SECONDS / 60,
    });

    void this.mail
      .sendCustomHtml(email, subject, html)
      .catch((err: Error) =>
        this.logger.warn(
          `RECOVER_EMAIL_FAIL email=${masked}: ${err.message}`,
        ),
      );

    this.logger.log(
      `RECOVER_OTP_ISSUED email=${masked} ip=${ip} regs=${regs.length} ttl=${OTP_TTL_SECONDS}s`,
    );

    return { ok: true, sent_to: masked };
  }

  // -------- Step 2: verify OTP --------

  async verifyOtp(
    rawEmail: string,
    otp: string,
  ): Promise<VerifyRecoverOtpResponseDto> {
    const email = rawEmail.trim().toLowerCase();
    const masked = maskEmail(email);
    const key = `recover:otp:${email}`;

    const raw = await this.redis.get(key);
    if (!raw) {
      // Same error message for "never requested" vs "expired" vs "burned
      // after max attempts" — attacker gains no signal.
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    let stored: StoredOtp;
    try {
      stored = JSON.parse(raw) as StoredOtp;
    } catch {
      // Corrupt value — nuke and force re-request.
      await this.redis.del(key);
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    // Increment attempts BEFORE comparison — this way a correct guess on the
    // 6th try doesn't succeed. Use INCR semantics via set+ttl preserve.
    stored.attempts += 1;

    if (stored.attempts > MAX_OTP_ATTEMPTS) {
      await this.redis.del(key);
      this.logger.warn(
        `RECOVER_OTP_BURNED email=${masked} attempts=${stored.attempts}`,
      );
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (stored.otp !== otp.trim()) {
      // Persist the bumped counter so 5 wrong tries really locks out.
      const ttl = await this.redis.ttl(key);
      await this.redis.set(
        key,
        JSON.stringify(stored),
        'EX',
        ttl > 0 ? ttl : OTP_TTL_SECONDS,
      );
      this.logger.log(
        `RECOVER_OTP_WRONG email=${masked} attempts=${stored.attempts}/${MAX_OTP_ATTEMPTS}`,
      );
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    // Match → consume the OTP immediately (single-use).
    await this.redis.del(key);

    const regs = await this.regRepo.find({
      where: { email, status: In(ACTIVE_STATUSES) },
      relations: { event: true, role: true },
      order: { created_at: 'DESC' },
    });

    if (regs.length === 0) {
      // Extreme edge case: TNV's registrations were cancelled between
      // requestOtp and verifyOtp. Return empty list, not an error — UI
      // handles it gracefully.
      this.logger.log(
        `RECOVER_OTP_OK_BUT_NO_ACTIVE email=${masked} — all regs became terminal mid-flow`,
      );
    } else {
      this.logger.log(
        `RECOVER_OTP_OK email=${masked} regs=${regs.length}`,
      );
    }

    const registrations: RecoveredRegistrationDto[] = regs.map((r) => ({
      event_id: r.event_id,
      event_name: r.event?.event_name ?? '',
      role_name: r.role?.role_name ?? '',
      full_name: r.full_name,
      status: r.status,
      magic_link: `${env.teamManagement.crewBaseUrl}/status/${r.magic_token}`,
    }));

    return { registrations };
  }

  // -------- helpers --------

  private async checkAndBumpRateLimit(
    key: string,
    max: number,
    label: string,
    display: string,
  ): Promise<void> {
    // INCR semantics with TTL preserved — if key doesn't exist, INCR creates
    // it as 1 and we set EXPIRE on first creation. Subsequent INCRs preserve
    // the original TTL.
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, RL_WINDOW_SECONDS);
    }
    if (count > max) {
      const ttl = await this.redis.ttl(key);
      this.logger.warn(
        `RECOVER_RATELIMIT label=${label} target=${display} count=${count}/${max} ttl=${ttl}s`,
      );
      throw new HttpException(
        `Đã yêu cầu quá ${max} lần trong 1 giờ. Thử lại sau ${
          ttl > 0 ? Math.ceil(ttl / 60) : 60
        } phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async verifyTurnstile(token: string, ip: string): Promise<boolean> {
    if (!token || token.length < 10) return false;
    try {
      const body = new URLSearchParams();
      body.set('secret', env.turnstile.secretKey);
      body.set('response', token);
      if (ip) body.set('remoteip', ip);
      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body,
          // 5s is generous — Cloudflare typically responds in <200ms.
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `Turnstile verify HTTP ${res.status} — failing closed`,
        );
        return false;
      }
      const data = (await res.json()) as { success?: boolean };
      return data.success === true;
    } catch (err) {
      this.logger.warn(
        `Turnstile verify threw: ${(err as Error).message} — failing closed`,
      );
      return false;
    }
  }
}

// ---- module-scope helpers ----

/**
 * Mask an email for display / logging. Keeps domain for context but obscures
 * the local part. "dannynguyen@5bib.com" → "da***@5bib.com".
 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0] ?? ''}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

function buildOtpEmailHtml(args: {
  otp: string;
  eventNames: string;
  ttlMinutes: number;
}): string {
  const { otp, eventNames, ttlMinutes } = args;
  // Minimal inline-styled HTML — Gmail/Outlook strip <style> tags.
  return `
<!DOCTYPE html>
<html lang="vi">
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#1e293b">
  <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px 28px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a">Khôi phục link truy cập Portal 5BIB</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569">
        Bạn vừa yêu cầu khôi phục link truy cập portal TNV${
          eventNames ? ` cho sự kiện <strong>${escapeHtml(eventNames)}</strong>` : ''
        }.
        Nhập mã sau vào trang khôi phục để nhận link portal:
      </p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px 0;background:#f1f5f9;border-radius:8px;color:#0f172a;font-family:'SF Mono',Consolas,monospace">
        ${escapeHtml(otp)}
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.5">
        Mã hết hạn sau ${ttlMinutes} phút. Nếu bạn không yêu cầu, bỏ qua email này —
        không ai truy cập được vào tài khoản nếu chưa có mã.
      </p>
    </td></tr>
    <tr><td style="padding:12px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
      5BIB · Team Management
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
