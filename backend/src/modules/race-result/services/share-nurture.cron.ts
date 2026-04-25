import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShareEventService } from './share-event.service';
import { ResultClaim, ResultClaimDocument } from '../schemas/result-claim.schema';

/**
 * D-4 Email nurture — 24h after share milestone.
 *
 * Policy:
 *  - Scans `share_events` for bibs crossing `MIN_SHARES_THRESHOLD` in the last
 *    24h.
 *  - Joins against `result_claims` (the only table with a verified email
 *    address for an athlete). Unclaimed bibs are skipped — we have no email.
 *  - Sends one "your result photo has been shared X times" nudge per bib.
 *    Dedupes via an in-memory Set keyed by `{raceId}:{bib}:{day}` within the
 *    process. For production across multiple instances, swap the Set for a
 *    Redis SET with `EXPIRE 86400`.
 *
 * Currently the actual Mailchimp send is stubbed (log only) — wire to
 * MailchimpService.sendTemplate(...) once the template slug is provisioned.
 * Mailchimp template name (agreed with PM): `result-share-nurture-24h`.
 */
@Injectable()
export class ShareNurtureCron {
  private readonly logger = new Logger(ShareNurtureCron.name);
  private readonly sentToday = new Set<string>();
  private lastClearedDay = this.dayKey();
  /**
   * Minimum shares in the 24h window before we trigger a nudge. Keeps the
   * email volume reasonable even if only 1% of athletes share.
   */
  private readonly MIN_SHARES_THRESHOLD = 5;

  constructor(
    private readonly shareEvents: ShareEventService,
    @InjectModel(ResultClaim.name)
    private readonly claims: Model<ResultClaimDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleCron(): Promise<void> {
    try {
      this.maybeResetSentCache();

      const trending = await this.shareEvents.findTrendingAthletes({
        sinceHoursAgo: 24,
        minShares: this.MIN_SHARES_THRESHOLD,
        limit: 500,
      });
      if (trending.length === 0) {
        this.logger.log('No trending athletes crossed nurture threshold');
        return;
      }

      this.logger.log(
        `Nurture candidates: ${trending.length} bibs with ≥${this.MIN_SHARES_THRESHOLD} shares in 24h`,
      );

      let sent = 0;
      let skipped = 0;
      for (const { raceId, bib, shares } of trending) {
        const dedupeKey = `${raceId}:${bib}:${this.lastClearedDay}`;
        if (this.sentToday.has(dedupeKey)) {
          skipped++;
          continue;
        }

        const claim = await this.claims
          .findOne({ raceId, bib, status: 'approved' })
          .lean()
          .exec();
        if (!claim?.email) {
          skipped++;
          continue;
        }

        await this.sendShareNudge({
          email: claim.email,
          name: claim.name ?? '',
          bib,
          raceId,
          shares,
        });
        this.sentToday.add(dedupeKey);
        sent++;
      }

      this.logger.log(
        `Nurture cron done: ${sent} sent, ${skipped} skipped (already-sent-or-no-email)`,
      );
    } catch (err) {
      this.logger.error(
        `Nurture cron failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Actual Mailchimp send. Currently stubbed — logs the intent and returns.
   *
   * TODO (sprint 3): inject MailchimpService and wire to:
   *   await this.mailchimp.sendTemplate({
   *     template_name: 'result-share-nurture-24h',
   *     to: [{ email, name, type: 'to' }],
   *     merge_vars: [{ rcpt: email, vars: [
   *       { name: 'athlete_name', content: name },
   *       { name: 'shares', content: String(shares) },
   *       { name: 'share_url', content: `https://result.5bib.com/races/${raceSlug}/${bib}` },
   *     ]}],
   *   });
   */
  private async sendShareNudge(input: {
    email: string;
    name: string;
    bib: string;
    raceId: string;
    shares: number;
  }): Promise<void> {
    this.logger.log(
      `[STUB] Would send nurture email to ${input.email} — bib ${input.bib}, ${input.shares} shares, race ${input.raceId}`,
    );
  }

  private dayKey(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  }

  private maybeResetSentCache(): void {
    const today = this.dayKey();
    if (today !== this.lastClearedDay) {
      this.sentToday.clear();
      this.lastClearedDay = today;
    }
  }
}
