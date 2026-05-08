/**
 * F-015 — Race.checkInWindow backfill migration.
 *
 * STATUS: STAGING-ONLY first per Manager Plan PAUSE point #4. PROD runs only
 * after Manager + Danny sign-off.
 *
 * Idempotency:
 *   - Only sets `checkInWindow` where field is currently undefined / null AND
 *     `startDate` is a valid Date.
 *   - Re-running this migration is a no-op for races already backfilled.
 *
 * Formula:
 *   - start = race.startDate - 3 days
 *   - end   = race.startDate - 1 hour
 *
 * Usage (staging):
 *   MONGODB_URL=... MONGODB_DB_NAME=... \
 *     npx ts-node backend/migrations/2026-05-08-add-check-in-window.ts
 *
 *   # OR dry-run mode (no writes; prints sample plan)
 *   DRY_RUN=1 npx ts-node backend/migrations/2026-05-08-add-check-in-window.ts
 */

import { MongoClient } from 'mongodb';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface RaceDoc {
  _id: unknown;
  title?: string;
  status?: string;
  startDate?: Date | string | null;
  checkInWindow?: { start: Date | null; end: Date | null } | null;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGODB_URL and MONGODB_DB_NAME env vars required');
  }
  const dryRun = process.env.DRY_RUN === '1';

  // eslint-disable-next-line no-console
  console.log(`[migration] checkInWindow backfill — dryRun=${dryRun}`);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const races = db.collection<RaceDoc>('races');

    const targets = await races
      .find({
        $and: [
          {
            $or: [
              { checkInWindow: { $exists: false } },
              { checkInWindow: null },
            ],
          },
          { startDate: { $exists: true, $type: 'date' } },
        ],
      })
      .project({ _id: 1, title: 1, status: 1, startDate: 1 })
      .toArray();

    // eslint-disable-next-line no-console
    console.log(`[migration] candidates: ${targets.length}`);

    let updated = 0;
    let skipped = 0;
    for (const race of targets) {
      const sd = race.startDate;
      if (!(sd instanceof Date) || Number.isNaN(sd.getTime())) {
        skipped++;
        continue;
      }
      const start = new Date(sd.getTime() - THREE_DAYS_MS);
      const end = new Date(sd.getTime() - ONE_HOUR_MS);
      if (dryRun) {
        // eslint-disable-next-line no-console
        console.log(
          `  [dry] race=${String(race._id)} title="${race.title ?? ''}" status=${race.status ?? ''} ` +
            `start=${start.toISOString()} end=${end.toISOString()}`,
        );
        continue;
      }
      const res = await races.updateOne(
        {
          _id: race._id,
          $or: [
            { checkInWindow: { $exists: false } },
            { checkInWindow: null },
          ],
        },
        { $set: { checkInWindow: { start, end } } },
      );
      if (res.modifiedCount > 0) updated++;
      else skipped++;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[migration] DONE — candidates=${targets.length} updated=${updated} skipped=${skipped}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migration] FAILED', err);
  process.exit(1);
});
