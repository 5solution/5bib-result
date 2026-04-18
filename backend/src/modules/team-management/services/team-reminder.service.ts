import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { env } from 'src/config';
import { MailService } from 'src/modules/notification/mail.service';
import { VolRegistration } from '../entities/vol-registration.entity';

const REMINDER_TTL_SECONDS = 48 * 3600;

/**
 * Sends "T-3 days" reminder emails to all approved registrants whose event
 * starts in exactly 3 days. Uses a Redis marker key so that multiple cron
 * invocations within the TTL window don't duplicate emails.
 */
@Injectable()
export class TeamReminderService {
  private readonly logger = new Logger(TeamReminderService.name);

  constructor(
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRedis() private readonly redis: Redis,
    private readonly mail: MailService,
  ) {}

  // 08:00 Vietnam time every day (server is UTC → 01:00 UTC).
  @Cron('0 1 * * *', { name: 'team-reminder-t-minus-3' })
  async runDailyReminder(): Promise<void> {
    // v1.4: target anyone fully cleared for the event (has QR, signed HĐ).
    // Pre-contract rows get reminders via the admin workflow, not T-3.
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.event', 'event')
      .leftJoinAndSelect('r.role', 'role')
      .where("r.status IN ('qr_sent', 'checked_in')")
      .andWhere('event.event_start_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)')
      .getMany();

    if (rows.length === 0) {
      this.logger.debug('T-3 reminder: no targets today');
      return;
    }
    this.logger.log(`T-3 reminder: ${rows.length} target(s) today`);

    for (const reg of rows) {
      await this.sendIfNotAlready(reg);
    }
  }

  private async sendIfNotAlready(reg: VolRegistration): Promise<void> {
    const key = `team:reminder:sent:${reg.id}`;
    const ok = await this.redis.set(key, '1', 'EX', REMINDER_TTL_SECONDS, 'NX');
    if (ok !== 'OK') return; // already sent within 48h window
    try {
      await this.mail.sendTeamReminderT3({
        toEmail: reg.email,
        fullName: reg.full_name,
        eventName: reg.event?.event_name ?? '',
        roleName: reg.role?.role_name ?? '',
        eventStartDate: String(reg.event?.event_start_date ?? ''),
        eventLocation: reg.event?.location ?? '',
        magicLink: `${env.teamManagement.crewBaseUrl}/status/${reg.magic_token}`,
      });
    } catch (err) {
      this.logger.warn(
        `Reminder email failed reg=${reg.id}: ${(err as Error).message}`,
      );
      // Release the marker so the next cron run retries.
      await this.redis.del(key);
    }
  }
}
