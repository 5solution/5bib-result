import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../../race-master-data/schemas/race-athlete.schema';
import { CheckInLog, CheckInLogDocument } from './check-in-log.schema';
import { CheckInSseService } from './check-in-sse.service';
import {
  AthletePreviewDto,
  ConfirmRequestDto,
  ConfirmResultDto,
} from './dto/check-in.dto';
import {
  CheckInStatsDataDto,
  RecentEventDto,
  StationCounterDto,
} from './dto/check-in-stats.dto';

/**
 * F-015 BR-CK-01..22 — Check-In Kiosk service.
 *
 * BR-CK-20 boundary: this service does NOT import any
 * `chip-verification/*` symbol. Convergence is at MongoDB only — both
 * modules write `RaceMasterData.racekit_received` via independent
 * `findOneAndUpdate({racekit_received: false}, ...)` first-wins.
 *
 * Atomic check-in pattern (BR-CK-04 / BR-CK-05):
 *  1. Redis SETNX `checkin:lock:{raceId}:{bib}` 5s TTL → 409 if held
 *  2. Mongo findOneAndUpdate({racekit_received: false}, ...) → 409 if matched 0
 *  3. INSERT check_in_logs
 *  4. Publish SSE pickup event
 *  5. DEL `checkin:race:{raceId}:stats` (force recompute)
 *  6. Best-effort DEL Redis lock (TTL safety net if process crashes mid-step)
 *
 * BR-CK-10 PII: CMND lookup never logs the typed digits. We MAY log the
 * BIB number but NEVER the CMND-last-4 query value. The logger guard at the
 * controller boundary echoes only `mode`, `bib`, `athlete_id`.
 */
@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);
  private static readonly LOCK_TTL_SECONDS = 5;
  private static readonly STATS_TTL_SECONDS = 60;

  constructor(
    @InjectModel(RaceAthlete.name)
    private readonly athleteModel: Model<RaceAthleteDocument>,
    @InjectModel(CheckInLog.name)
    private readonly logModel: Model<CheckInLogDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly sse: CheckInSseService,
  ) {}

  /** BR-CK-04 lock key. */
  private static lockKey(raceId: number, bib: string): string {
    return `checkin:lock:${raceId}:${bib}`;
  }

  private static statsKey(raceId: number): string {
    return `checkin:race:${raceId}:stats`;
  }

  private parseRaceId(raceId: string): number {
    const n = parseInt(raceId, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new NotFoundException(`Invalid race id: ${raceId}`);
    }
    return n;
  }

  private mapAthletePreview(a: RaceAthleteDocument): AthletePreviewDto {
    return {
      athleteId: a.athletes_id,
      bib: a.bib_number ?? '',
      name: a.display_name ?? a.bib_name ?? a.full_name ?? '',
      course: a.course_name ?? null,
      courseDistance: a.course_distance ?? null,
      gender: a.gender ?? null,
      // RaceAthlete schema does NOT carry t-shirt size as a typed field;
      // `items` is the free-form vendor field surfaced for BTC reference.
      size: null,
      items: a.items ?? null,
      racekitReceived: a.racekit_received,
      racekitReceivedAt: a.racekit_received_at?.toISOString?.() ?? null,
      pickedUpAtStation: null,
      chipVerified: undefined,
    };
  }

  /**
   * BR-CK-01/02 — BIB lookup. BIB digit-strip + leading-zero cleanup match the
   * frontend BR-CK-01 contract.
   */
  async lookupByBib(raceId: string, bib: string): Promise<AthletePreviewDto | null> {
    const numericRaceId = this.parseRaceId(raceId);
    const cleaned = bib.replace(/\D+/g, '').replace(/^0+/, '');
    if (!cleaned) return null;
    const athlete = await this.athleteModel
      .findOne({ mysql_race_id: numericRaceId, bib_number: cleaned })
      .lean<RaceAthleteDocument | null>()
      .exec();
    if (!athlete) return null;
    return this.mapAthletePreview(athlete as RaceAthleteDocument);
  }

  /**
   * BR-CK-10 — CMND last-4 fuzzy match. We DO NOT log the input value.
   *
   * Implementation: athlete.id_number is `select: false` so we explicit-select
   * + match suffix. Returns up to 5 candidates. >5 → throws ServiceUnavailable
   * to prevent broad fuzzy responses (privacy safeguard).
   */
  async lookupByCmndLastFour(
    raceId: string,
    last4: string,
  ): Promise<AthletePreviewDto[]> {
    const numericRaceId = this.parseRaceId(raceId);
    if (!/^[0-9]{4}$/.test(last4)) {
      // BR-CK-10 guard — backend echoes generic 400 (no value in error).
      throw new NotFoundException('Invalid CMND query');
    }
    // Match athletes whose id_number ends with last4 (case-insensitive trim).
    const candidates = await this.athleteModel
      .find({
        mysql_race_id: numericRaceId,
        id_number: { $regex: `${last4}$` },
      })
      .select('+id_number')
      .limit(6)
      .lean<RaceAthleteDocument[]>()
      .exec();
    if (candidates.length > 5) {
      // Privacy safeguard: too many matches → ask BTC to use BIB instead.
      throw new ServiceUnavailableException('Too many CMND matches — use BIB instead');
    }
    return candidates.map((a) => this.mapAthletePreview(a as RaceAthleteDocument));
  }

  /**
   * QR payload may be either a plain BIB number or a 5BIB-encoded string
   * containing `bib=NNNN` query/JSON shape. Phase 1 simple parse: try as BIB
   * first, fallback to JSON / regex.
   */
  async lookupByQr(raceId: string, payload: string): Promise<AthletePreviewDto | null> {
    if (!payload) return null;
    // Try BIB-only payload (most QR codes from 5BIB orders are bare numerics).
    if (/^[0-9]{1,6}$/.test(payload.trim())) {
      return this.lookupByBib(raceId, payload.trim());
    }
    // Try JSON envelope.
    try {
      const parsed = JSON.parse(payload) as { bib?: string | number };
      if (parsed?.bib !== undefined) {
        return this.lookupByBib(raceId, String(parsed.bib));
      }
    } catch {
      /* not JSON */
    }
    // Try `bib=NNNN` regex.
    const m = payload.match(/bib=([0-9]+)/i);
    if (m) {
      return this.lookupByBib(raceId, m[1]);
    }
    return null;
  }

  /**
   * BR-CK-04/05 — Atomic confirm pickup.
   *
   * @throws ConflictException(409) — Redis lock held OR Mongo matched 0
   *         (already picked up at another station).
   */
  async confirmPickup(
    raceId: string,
    bib: string,
    body: ConfirmRequestDto,
    actor: { userId: string | null },
  ): Promise<ConfirmResultDto> {
    const numericRaceId = this.parseRaceId(raceId);
    const cleanedBib = bib.replace(/\D+/g, '').replace(/^0+/, '');
    if (!cleanedBib) throw new NotFoundException('Invalid BIB');

    const athletesId = typeof body.athleteId === 'string'
      ? parseInt(body.athleteId, 10)
      : body.athleteId;
    if (!Number.isFinite(athletesId) || athletesId <= 0) {
      throw new NotFoundException('Invalid athlete id');
    }

    const lockKey = CheckInService.lockKey(numericRaceId, cleanedBib);
    // Step 1 — SETNX lock (best-effort distributed mutex).
    const lockRes = await this.redis.set(
      lockKey,
      `${body.stationId}:${actor.userId ?? 'anon'}`,
      'EX',
      CheckInService.LOCK_TTL_SECONDS,
      'NX',
    );
    if (lockRes !== 'OK') {
      throw new ConflictException({
        success: false,
        message: 'lock_held',
        code: 'CHECKIN_LOCK_HELD',
      });
    }

    let confirmedAt: Date;
    try {
      // Step 2 — Mongo first-wins atomic update. matchedCount=0 → already picked.
      confirmedAt = new Date();
      const updated = await this.athleteModel
        .findOneAndUpdate(
          {
            mysql_race_id: numericRaceId,
            bib_number: cleanedBib,
            athletes_id: athletesId,
            racekit_received: false,
          },
          {
            $set: {
              racekit_received: true,
              racekit_received_at: confirmedAt,
            },
          },
          { new: true },
        )
        .lean<RaceAthleteDocument | null>()
        .exec();

      if (!updated) {
        // Determine if (a) athlete missing or (b) already-picked. We surface 409
        // so frontend renders BR-CK-05 cooldown / BR-CK-03 already-picked banner.
        const exists = await this.athleteModel
          .findOne({
            mysql_race_id: numericRaceId,
            bib_number: cleanedBib,
            athletes_id: athletesId,
          })
          .lean<RaceAthleteDocument | null>()
          .exec();
        if (!exists) {
          throw new NotFoundException('Athlete not found');
        }
        throw new ConflictException({
          success: false,
          message: 'already_checked_in',
          code: 'CHECKIN_ALREADY_PICKED_UP',
          racekitReceivedAt: exists.racekit_received_at?.toISOString?.() ?? null,
        });
      }

      // Step 3 — Insert audit log (BR-CK-15 — NO name / NO CMND).
      await this.logModel.create({
        mysql_race_id: numericRaceId,
        bib_number: cleanedBib,
        athletes_id: athletesId,
        checked_in_at: confirmedAt,
        checked_in_by: actor.userId,
        station_id: body.stationId,
        source: body.source,
        sync_status: 'synced',
      });

      // Step 4 — Broadcast SSE pickup event.
      this.sse.emitPickup(String(numericRaceId), {
        bib: cleanedBib,
        athleteId: athletesId,
        stationId: body.stationId,
        checkedInAt: confirmedAt.toISOString(),
      });

      // Step 5 — Stats cache invalidate (force recompute next stats request).
      await this.redis.del(CheckInService.statsKey(numericRaceId)).catch(() => 0);
    } finally {
      // Step 6 — Best-effort lock release (TTL is safety net).
      await this.redis.del(lockKey).catch(() => 0);
    }

    return {
      bib: cleanedBib,
      athleteId: athletesId,
      checkedInAt: confirmedAt.toISOString(),
      stationId: body.stationId,
      source: body.source,
    };
  }

  /**
   * BR-CK-08/09 — Aggregate stats with 60s Redis cache.
   */
  async getStats(raceId: string): Promise<CheckInStatsDataDto> {
    const numericRaceId = this.parseRaceId(raceId);
    const cacheKey = CheckInService.statsKey(numericRaceId);
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as CheckInStatsDataDto;
      } catch {
        /* fallthrough */
      }
    }

    const [totalAthletes, pickedUp, perStationDocs, recentDocs] = await Promise.all([
      this.athleteModel.countDocuments({ mysql_race_id: numericRaceId }).exec(),
      this.athleteModel.countDocuments({
        mysql_race_id: numericRaceId,
        racekit_received: true,
      }).exec(),
      this.logModel.aggregate<{
        _id: string;
        count: number;
        lastActivityAt: Date | null;
      }>([
        { $match: { mysql_race_id: numericRaceId } },
        {
          $group: {
            _id: '$station_id',
            count: { $sum: 1 },
            lastActivityAt: { $max: '$checked_in_at' },
          },
        },
      ]).exec(),
      this.logModel
        .find({ mysql_race_id: numericRaceId })
        .sort({ checked_in_at: -1 })
        .limit(20)
        .lean<CheckInLogDocument[]>()
        .exec(),
    ]);

    // Compute rate-per-minute from the last 60s of audit logs.
    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const ratePerMinute = await this.logModel.countDocuments({
      mysql_race_id: numericRaceId,
      checked_in_at: { $gte: sixtySecondsAgo },
    }).exec();

    // Resolve athlete display names for recent feed (single-batch lookup).
    const athleteIds = recentDocs.map((d) => d.athletes_id);
    const athleteRows = athleteIds.length > 0
      ? await this.athleteModel
          .find({ mysql_race_id: numericRaceId, athletes_id: { $in: athleteIds } })
          .lean<RaceAthleteDocument[]>()
          .exec()
      : [];
    const nameByAthleteId = new Map<number, string>();
    for (const row of athleteRows) {
      const name = row.display_name ?? row.bib_name ?? row.full_name ?? '';
      nameByAthleteId.set(row.athletes_id, name);
    }

    const perStation: StationCounterDto[] = perStationDocs.map((s) => ({
      stationId: s._id,
      count: s.count,
      lastActivityAt: s.lastActivityAt?.toISOString?.() ?? null,
    }));
    perStation.sort((a, b) => a.stationId.localeCompare(b.stationId));

    const recentEvents: RecentEventDto[] = recentDocs.map((d) => ({
      bib: d.bib_number,
      name: nameByAthleteId.get(d.athletes_id) ?? null,
      stationId: d.station_id,
      checkedInAt: d.checked_in_at.toISOString(),
    }));

    const result: CheckInStatsDataDto = {
      totalAthletes,
      pickedUp,
      perStation,
      ratePerMinute,
      recentEvents,
    };

    await this.redis
      .setex(cacheKey, CheckInService.STATS_TTL_SECONDS, JSON.stringify(result))
      .catch(() => null);

    return result;
  }

  /** Verify race/checkpoint pre-race window if you'd like to enforce server-side. */
  async assertWindowOpen(raceId: string, _now: Date = new Date()): Promise<void> {
    // F-015 Phase 1: window check is enforced FE only (BR-CK-06). Backend is
    // intentionally permissive so admin override flows (Phase 2) don't have
    // to bypass server. Track this as TD-F015-05 if needed.
    void raceId;
    void _now;
    // Defensive throw guard if needed by Phase 2 — currently a no-op.
    if (false as boolean) throw new ForbiddenException('Outside check-in window');
  }
}
