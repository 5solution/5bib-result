import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import {
  AnomalyWarning,
  AnomalyWarningDocument,
  Resolution,
  Tier,
} from '../schemas/anomaly-warning.schema';
import {
  Podium,
  PodiumDocument,
  PodiumState,
} from '../schemas/podium.schema';
import { REDIS_TTL } from '../constants/awards-thresholds';
import {
  AGBracketCalcService,
  AthleteForRanking,
  computeOverallTopN,
} from './ag-bracket-calc.service';
import { AnomalyDetectorService } from './anomaly-detector.service';
import {
  NormalizeVendorQuirksService,
  NormalizedAthlete,
} from './normalize-vendor-quirks.service';
import { PredictedRankService } from './predicted-rank.service';
import { AgeComputerService } from './age-computer.service';
import { VendorMismatchDetectorService } from './vendor-mismatch-detector.service';
import { IndependentRankingService } from './independent-ranking.service';
import { AGEligibilityReportService } from './ag-eligibility-report.service';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../../race-master-data/schemas/race-athlete.schema';
import {
  AnomalyWarningResponseDto,
  AnomalyWarningListResponseDto,
  ListAnomalyFilterDto,
  AckWarningDto,
  ResolveWarningDto,
} from '../dto/anomaly-warning-response.dto';
import {
  ListPodiumFilterDto,
  PodiumListResponseDto,
  PodiumResponseDto,
  RecomputeRequestDto,
  RecomputeResponseDto,
} from '../dto/podium-response.dto';
import { defaultPresetFor } from '../constants/ag-presets';
import { PredictedRankItem } from './predicted-rank.service';
import { AwardsSseService } from './awards-sse.service';

/**
 * F-019 AwardsService — orchestrator.
 *
 * Coordinates AG calc → anomaly detection → state machine → predicted rank.
 * Forward-only state-machine transitions handled in PodiumStateMachineService.
 */
@Injectable()
export class AwardsService {
  private readonly logger = new Logger(AwardsService.name);

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(Podium.name)
    private readonly podiumModel: Model<PodiumDocument>,
    @InjectModel(AnomalyWarning.name)
    private readonly warningModel: Model<AnomalyWarningDocument>,
    @InjectModel(RaceAthlete.name)
    private readonly raceAthleteModel: Model<RaceAthleteDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly bracketCalc: AGBracketCalcService,
    private readonly normalizer: NormalizeVendorQuirksService,
    private readonly detector: AnomalyDetectorService,
    private readonly predictor: PredictedRankService,
    private readonly sse: AwardsSseService,
    private readonly ageComputer: AgeComputerService,
    private readonly vendorMismatch: VendorMismatchDetectorService,
    private readonly independentRanking: IndependentRankingService,
    private readonly eligibilityReport: AGEligibilityReportService,
  ) {}

  // ── Recompute orchestration ─────────────────────────────────────────────

  async recompute(
    raceId: string,
    dto: RecomputeRequestDto,
    actorId: string,
  ): Promise<RecomputeResponseDto> {
    const start = Date.now();

    // SETNX anti-stampede compute lock per (race, course).
    const lockKey = dto.courseId
      ? `awards:lock:${raceId}:${dto.courseId}`
      : `awards:lock:${raceId}:*`;
    const acquired = await this.redis.set(
      lockKey,
      actorId,
      'EX',
      REDIS_TTL.COMPUTE_LOCK,
      'NX',
    );
    if (!acquired) {
      throw new ConflictException(
        'Đang compute AG cho race/course này — thử lại sau ít giây',
      );
    }

    try {
      const race = await this.resolveRace(raceId);
      const courses = dto.courseId
        ? race.courses.filter((c) => c.courseId === dto.courseId)
        : race.courses;
      if (!courses.length) {
        throw new NotFoundException('Course không tồn tại');
      }

      let podiumsCreatedOrUpdated = 0;
      let warningsCreated = 0;
      const raceDay = race.startDate ?? new Date();

      // F-019 v2 — read race-level bracketSource override (default '5bib').
      const raceBracketSource =
        ((race as unknown as { bracketSource?: '5bib' | 'vendor' | 'hybrid' })
          .bracketSource ?? '5bib');

      // F-019 v2.1 — read race-level compoundingMode override (default 'mutually_exclusive' VN amateur).
      const raceCompoundingMode =
        ((race as unknown as {
          awardsCompoundingMode?: 'mutually_exclusive' | 'compounding';
        }).awardsCompoundingMode ?? 'mutually_exclusive');

      // F-019 v2 — pre-load ageOnRaceDay map from master-data race_athletes.
      // Map: bib_number → ageOnRaceDay. Athletes thiếu DOB → null → exclude
      // hoặc fallback Path B tùy bracketSource.
      const ageMap = await this.loadAgeMap(race);

      for (const course of courses) {
        // Reject recompute when any podium for this course is LOCKED+ (BR-AG-36 + state forward-only).
        const hasLocked = await this.podiumModel.exists({
          raceId,
          courseId: course.courseId,
          state: { $in: ['PODIUM_LOCKED', 'PODIUM_PUBLISHED', 'PODIUM_FINAL'] },
        });
        if (hasLocked) {
          this.logger.warn(
            `[awards] skip recompute ${raceId}/${course.courseId}: at least 1 podium is LOCKED+`,
          );
          continue;
        }

        const courseAny = course as unknown as {
          courseId: string;
          name: string;
          distanceKm?: number;
          courseType?: string;
          ageGroupPreset?: string;
          ageGroupOverride?: unknown;
        };
        const presetKey =
          courseAny.ageGroupPreset ?? defaultPresetFor(courseAny.courseType).presetKey;
        const courseDistanceKm = courseAny.distanceKm;

        // Pull race results for this course.
        const docs = await this.resultModel
          .find({ raceId, courseId: course.courseId })
          .lean();
        const normalized: NormalizedAthlete[] = docs.map((d) =>
          this.normalizer.normalizeAthlete({
            raceId,
            courseId: course.courseId,
            bib: d.bib,
            name: d.name,
            gender: d.gender,
            chipTime: d.chipTime,
            gunTime: d.gunTime,
            chiptimes: d.chiptimes,
            guntimes: d.guntimes,
            paces: d.paces,
            overallRanks: d.overallRanks,
            overallRank: d.overallRank,
            overallRankNumeric: d.overallRankNumeric,
            timingPoint: d.timingPoint,
            distance: d.distance,
            courseDistanceKm,
            category: d.category,
            nationality: d.nationality,
            splits: d.splits,
            rawData: d.rawData,
          }),
        );

        // F-019 v2 — AG calc with Path A (ageOnRaceDay) primary input.
        // Path A: hydrate ageOnRaceDay from master-data ageMap.
        // Path B: vendor `Category` with whitespace-trim guard (v1 bug fix).
        const eligibleAthletes: AthleteForRanking[] = normalized.map((n) => ({
          bib: n.bib,
          name: n.name,
          athleteId: undefined,
          gender: n.gender,
          ageOnRaceDay: ageMap.get(n.bib) ?? null,
          dateOfBirth: undefined, // raw DOB never crosses MongoDB boundary (BR-03)
          vendorAgeGroup: n.vendorAgeGroup,
          chipTimeMs: n.chipTimeMs,
          gunTimeMs: n.gunTimeMs,
          nationality: n.nationality,
        }));

        const buckets = this.bracketCalc.computeAGBuckets(eligibleAthletes, {
          presetKey,
          raceDay,
          agTopN: 3,
          compoundingMode: raceCompoundingMode,
          courseType: courseAny.courseType,
          bracketSource: raceBracketSource,
        });

        // F-019 v2 — Pattern H VENDOR_MISMATCH detection (cross-check 5BIB
        // top-3 AG vs Vendor top-3 — emit anomaly if ≥1 BIB diff).
        const mismatches = this.vendorMismatch.detectMismatches(
          buckets,
          normalized,
        );
        for (const m of mismatches) {
          const wfilter = {
            raceId,
            courseId: course.courseId,
            bib: m.evidence.bib,
            pattern: m.pattern,
          };
          const wupdate = {
            $set: {
              raceId,
              mongoRaceId: new Types.ObjectId(race._id as unknown as string),
              courseId: course.courseId,
              bib: m.evidence.bib,
              pattern: m.pattern,
              tier: m.tier,
              confidence: m.confidence,
              evidence: m.evidence,
            },
            $setOnInsert: {
              resolution: 'pending' as Resolution,
              transitionHistory: [
                {
                  action: 'detected',
                  actorId: 'system',
                  at: new Date(),
                  note: `Pattern H VENDOR_MISMATCH detected at conf=${m.confidence.toFixed(2)} severity=${m.evidence.severityLabel}`,
                  newTier: m.tier,
                },
              ],
            },
          };
          const wupserted = await this.warningModel.findOneAndUpdate(
            wfilter,
            wupdate,
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
          if (wupserted) {
            warningsCreated += 1;
            this.sse.emit('warning.created', raceId, {
              warningId: String(
                (wupserted as unknown as { _id: Types.ObjectId })._id,
              ),
              pattern: m.pattern,
              tier: m.tier,
            });
          }
        }

        // Upsert each AG podium doc (one per ageGroupKey × gender).
        for (const bucket of buckets) {
          const filter = {
            raceId,
            courseId: course.courseId,
            ageGroupKey: bucket.ageGroupKey,
            gender: bucket.gender,
          };
          const update = {
            $set: {
              raceId,
              mongoRaceId: new Types.ObjectId(race._id as unknown as string),
              courseId: course.courseId,
              courseName: course.name,
              courseDistanceKm,
              ageGroupKey: bucket.ageGroupKey,
              ageGroup: bucket.ageGroup,
              ageGroupLabel: bucket.ageGroupLabel,
              gender: bucket.gender,
              presetKey,
              compoundingMode: raceCompoundingMode,
              agTopN: 3,
              podiumType: 'AG',
              athletes: bucket.athletes.map((a) => ({
                bib: a.bib,
                name: a.name ?? a.bib,
                rank: a.rank,
                chipTimeMs: a.chipTimeMs,
                chipTime: undefined,
                gunTimeMs: a.gunTimeMs,
                gender: a.gender,
                ageOnRaceDay: a.ageOnRaceDay,
                nationality: a.nationality,
                tied: a.tied,
              })),
              state: 'AG_COMPUTED' as PodiumState,
              computedAt: new Date(),
            },
            $setOnInsert: {
              stateHistory: [
                {
                  fromState: 'INITIAL',
                  toState: 'AG_COMPUTED',
                  actorId,
                  at: new Date(),
                  note: 'Initial AG computation',
                },
              ],
            },
          };
          const upserted = await this.podiumModel.findOneAndUpdate(
            filter,
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
          if (upserted) {
            podiumsCreatedOrUpdated += 1;
            this.sse.emit('podium.computed', raceId, {
              podiumId: String((upserted as unknown as { _id: Types.ObjectId })._id),
              ageGroupKey: bucket.ageGroupKey,
              gender: bucket.gender,
            });
          }
        }

        // F-020 BR-AG-41/42/50 — upsert 1 OVERALL podium per course song song
        // với AG buckets. Persist trong CẢ 2 modes (mutually_exclusive +
        // compounding) để BTC luôn có chỗ tra cứu top chung cuộc race day.
        // Tie-break BIB ASC trong helper computeOverallTopN — KHÔNG dùng
        // tied-tail logic của AG bucket vì OVERALL chỉ trao 3 medal cố định.
        const overallTop = computeOverallTopN(eligibleAthletes, 3);
        if (overallTop.length > 0) {
          const overallFilter = {
            raceId,
            courseId: course.courseId,
            ageGroupKey: '__OVERALL__',
            gender: 'mixed',
          };
          const overallUpdate = {
            $set: {
              raceId,
              mongoRaceId: new Types.ObjectId(race._id as unknown as string),
              courseId: course.courseId,
              courseName: course.name,
              courseDistanceKm,
              ageGroupKey: '__OVERALL__',
              ageGroup: 'Overall',
              ageGroupLabel: 'Top Chung Cuộc',
              gender: 'mixed',
              presetKey,
              compoundingMode: raceCompoundingMode,
              agTopN: 3,
              podiumType: 'OVERALL',
              athletes: overallTop.map((a, idx) => ({
                bib: a.bib,
                name: a.name ?? a.bib,
                rank: idx + 1,
                chipTimeMs: a.chipTimeMs ?? undefined,
                chipTime: undefined,
                gunTimeMs: a.gunTimeMs ?? undefined,
                gender: a.gender ?? undefined,
                ageOnRaceDay: a.ageOnRaceDay ?? undefined,
                nationality: a.nationality,
                tied: false,
              })),
              state: 'AG_COMPUTED' as PodiumState,
              computedAt: new Date(),
            },
            $setOnInsert: {
              stateHistory: [
                {
                  fromState: 'INITIAL',
                  toState: 'AG_COMPUTED',
                  actorId,
                  at: new Date(),
                  note: 'Initial OVERALL computation (F-020)',
                },
              ],
            },
          };
          const overallUpserted = await this.podiumModel.findOneAndUpdate(
            overallFilter,
            overallUpdate,
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
          if (overallUpserted) {
            podiumsCreatedOrUpdated += 1;
            this.sse.emit('podium.computed', raceId, {
              podiumId: String(
                (overallUpserted as unknown as { _id: Types.ObjectId })._id,
              ),
              ageGroupKey: '__OVERALL__',
              gender: 'mixed',
            });
          }
        }

        // Anomaly detection.
        const ctx = {
          raceDay,
          courseType: this.mapCourseType(courseAny.courseType),
          confidenceMultiplier: 0.2, // F-010 default; Phase 2 read from TimingAlertConfig
        };
        for (const n of normalized) {
          const results = this.detector.detectAll(n, ctx);
          for (const r of results) {
            // Upsert one warning per (race, course, bib, pattern) — re-trigger updates evidence + tier.
            const wfilter = {
              raceId,
              courseId: course.courseId,
              bib: n.bib,
              pattern: r.pattern,
            };
            const wupdate = {
              $set: {
                raceId,
                mongoRaceId: new Types.ObjectId(race._id as unknown as string),
                courseId: course.courseId,
                bib: n.bib,
                athleteName: n.name,
                pattern: r.pattern,
                tier: r.tier,
                confidence: r.confidence,
                evidence: r.evidence,
              },
              $setOnInsert: {
                resolution: 'pending' as Resolution,
                transitionHistory: [
                  {
                    action: 'detected',
                    actorId: 'system',
                    at: new Date(),
                    note: `Pattern ${r.pattern} detected at conf=${r.confidence.toFixed(2)}`,
                    newTier: r.tier,
                  },
                ],
              },
            };
            const wupserted = await this.warningModel.findOneAndUpdate(
              wfilter,
              wupdate,
              { upsert: true, new: true, setDefaultsOnInsert: true },
            );
            if (wupserted) {
              warningsCreated += 1;
              this.sse.emit('warning.created', raceId, {
                warningId: String((wupserted as unknown as { _id: Types.ObjectId })._id),
                pattern: r.pattern,
                tier: r.tier,
              });
            }
          }
        }
      }

      await this.invalidateRaceCache(raceId);
      // F-019 v2 — invalidate eligibility report cache (covered fields shift
      // after bracketDistribution changes via new ageOnRaceDay reads).
      await this.eligibilityReport.invalidate(raceId);
      const durationMs = Date.now() - start;
      this.logger.log(
        `[awards] recompute race=${raceId} bracketSource=${raceBracketSource} ageMapSize=${ageMap.size} podiums=${podiumsCreatedOrUpdated} warnings=${warningsCreated} ms=${durationMs}`,
      );
      return {
        raceId,
        podiumsCreatedOrUpdated,
        warningsCreated,
        durationMs,
        bracketSource: raceBracketSource,
      };
    } finally {
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }

  /**
   * F-019 v2 — resolve mysql_race_id từ Mongo Race document.
   *
   * Race schema KHÔNG store `mysql_race_id` direct — link qua
   * `chip_race_config.mongo_race_id ↔ mysql_race_id`. Pattern này là legacy
   * bridge (chip-verification module pioneer). Awards reuses cùng linkage.
   */
  private async resolveMysqlRaceId(
    raceId: string,
  ): Promise<number | null> {
    try {
      const linkDoc = await this.raceModel.db
        .collection('chip_race_configs')
        .findOne({ mongo_race_id: raceId });
      if (linkDoc && typeof linkDoc.mysql_race_id === 'number') {
        return linkDoc.mysql_race_id;
      }
    } catch {
      /* fallthrough — return null */
    }
    return null;
  }

  /**
   * F-019 v2 — load `bib → ageOnRaceDay` map from master-data race_athletes.
   * Returns empty Map khi race không có chip_race_config link (legacy) hoặc
   * sync `ageOnRaceDay` cron chưa chạy.
   */
  private async loadAgeMap(race: RaceDocument): Promise<Map<string, number>> {
    const raceId = String(race._id);
    const mysqlRaceId = await this.resolveMysqlRaceId(raceId);
    if (!mysqlRaceId) {
      this.logger.warn(
        `[awards.v2] race=${raceId} không có chip_race_config link — Path A skip, Path B fallback nếu vendor có Category`,
      );
      return new Map();
    }

    const docs = await this.raceAthleteModel
      .find({
        mysql_race_id: mysqlRaceId,
        ageOnRaceDay: { $ne: null, $gte: 0 },
      })
      .select('bib_number ageOnRaceDay')
      .lean();

    const map = new Map<string, number>();
    for (const d of docs) {
      const dAny = d as unknown as {
        bib_number?: string;
        ageOnRaceDay?: number;
      };
      if (dAny.bib_number && dAny.ageOnRaceDay != null) {
        map.set(dAny.bib_number, dAny.ageOnRaceDay);
      }
    }
    return map;
  }

  // ── Listing / detail ───────────────────────────────────────────────────

  async listPodium(
    raceId: string,
    filter: ListPodiumFilterDto,
  ): Promise<PodiumListResponseDto> {
    const q: Record<string, unknown> = { raceId };
    if (filter.courseId) q.courseId = filter.courseId;
    if (filter.gender) q.gender = filter.gender;
    if (filter.ageGroup) q.ageGroup = filter.ageGroup;
    if (filter.state) q.state = filter.state;
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;
    const [items, total, allStates] = await Promise.all([
      this.podiumModel
        .find(q)
        .sort({ courseId: 1, gender: 1, ageGroupKey: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.podiumModel.countDocuments(q),
      this.podiumModel.aggregate([
        { $match: { raceId } },
        { $group: { _id: '$state', n: { $sum: 1 } } },
      ]),
    ]);
    const countsByState: Record<string, number> = {};
    for (const r of allStates as Array<{ _id: string; n: number }>) {
      countsByState[r._id] = r.n;
    }
    return {
      items: items.map((i) => this.toPodiumResponse(i as PodiumDocument)),
      total,
      countsByState,
    };
  }

  async getPodium(raceId: string, podiumId: string): Promise<PodiumResponseDto> {
    if (!Types.ObjectId.isValid(podiumId)) throw new NotFoundException();
    const p = await this.podiumModel.findOne({ _id: podiumId, raceId }).lean();
    if (!p) throw new NotFoundException();
    return this.toPodiumResponse(p as PodiumDocument);
  }

  // ── Anomaly listing / mutations ────────────────────────────────────────

  async listWarnings(
    raceId: string,
    filter: ListAnomalyFilterDto,
  ): Promise<AnomalyWarningListResponseDto> {
    const q: Record<string, unknown> = { raceId };
    if (filter.courseId) q.courseId = filter.courseId;
    if (filter.tier != null) q.tier = filter.tier;
    if (filter.resolution) q.resolution = filter.resolution;
    const limit = filter.limit ?? 200;
    const offset = filter.offset ?? 0;
    const [items, total, byTierRaw] = await Promise.all([
      this.warningModel
        .find(q)
        .sort({ tier: 1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.warningModel.countDocuments(q),
      this.warningModel.aggregate([
        { $match: { raceId, ...(filter.courseId ? { courseId: filter.courseId } : {}) } },
        { $group: { _id: '$tier', n: { $sum: 1 } } },
      ]),
    ]);
    const countsByTier: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    for (const r of byTierRaw as Array<{ _id: number; n: number }>) {
      countsByTier[String(r._id)] = r.n;
    }
    const blockingCount = await this.warningModel.countDocuments({
      raceId,
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      tier: { $in: [1, 2] },
      resolution: 'pending',
    });
    return {
      items: items.map((i) => this.toWarningResponse(i as AnomalyWarningDocument)),
      total,
      countsByTier,
      blockingCount,
    };
  }

  async ackWarning(
    raceId: string,
    warningId: string,
    dto: AckWarningDto,
    actorId: string,
  ): Promise<AnomalyWarningResponseDto> {
    if (!Types.ObjectId.isValid(warningId)) throw new NotFoundException();
    const updated = await this.warningModel.findOneAndUpdate(
      { _id: warningId, raceId, ackedAt: { $exists: false } },
      {
        $set: {
          ackedBy: actorId,
          ackedAt: new Date(),
          ackNote: dto.note,
        },
        $push: {
          transitionHistory: {
            action: 'ack',
            actorId,
            at: new Date(),
            note: dto.note,
            evidenceUrl: dto.evidenceUrl,
          },
        },
      },
      { new: true },
    );
    if (!updated) {
      // Either not found, or already acked — surface as 409 to avoid silent overwrite.
      const exists = await this.warningModel.exists({ _id: warningId, raceId });
      if (!exists) throw new NotFoundException();
      throw new ConflictException(
        'Cảnh báo đã được acknowledge bởi người khác — refresh',
      );
    }
    this.sse.emit('warning.acked', raceId, { warningId });
    await this.invalidateRaceCache(raceId);
    return this.toWarningResponse(updated as AnomalyWarningDocument);
  }

  async resolveWarning(
    raceId: string,
    warningId: string,
    dto: ResolveWarningDto,
    actorId: string,
  ): Promise<AnomalyWarningResponseDto> {
    if (!Types.ObjectId.isValid(warningId)) throw new NotFoundException();
    if (
      dto.resolution !== 'ignored' &&
      dto.resolution !== 'fixed' &&
      dto.resolution !== 'btc_override'
    ) {
      throw new BadRequestException('Resolution invalid');
    }
    const $set: Record<string, unknown> = {
      resolution: dto.resolution,
      resolvedBy: actorId,
      resolvedAt: new Date(),
      resolutionNote: dto.note,
    };
    if (dto.overrideTier != null) {
      $set.overrideTier = dto.overrideTier;
    }
    const updated = await this.warningModel.findOneAndUpdate(
      { _id: warningId, raceId, resolution: 'pending' },
      {
        $set,
        $push: {
          transitionHistory: {
            action: 'resolve',
            actorId,
            at: new Date(),
            note: dto.note,
            evidenceUrl: dto.evidenceUrl,
            newTier: dto.overrideTier,
          },
        },
      },
      { new: true },
    );
    if (!updated) {
      const exists = await this.warningModel.exists({ _id: warningId, raceId });
      if (!exists) throw new NotFoundException();
      throw new ConflictException('Cảnh báo đã được resolve bởi người khác');
    }
    this.sse.emit('warning.resolved', raceId, {
      warningId,
      resolution: dto.resolution,
    });
    await this.invalidateRaceCache(raceId);
    return this.toWarningResponse(updated as AnomalyWarningDocument);
  }

  // ── Predicted rank list ────────────────────────────────────────────────

  async predictedRanks(raceId: string): Promise<PredictedRankItem[]> {
    const race = await this.resolveRace(raceId);
    const items: PredictedRankItem[] = [];
    for (const course of race.courses) {
      const courseAny = course as unknown as {
        courseId: string;
        distanceKm?: number;
        courseType?: string;
      };
      if (!courseAny.distanceKm) continue;
      const docs = await this.resultModel
        .find({ raceId, courseId: courseAny.courseId })
        .lean();
      const normalized: NormalizedAthlete[] = docs.map((d) =>
        this.normalizer.normalizeAthlete({
          raceId,
          courseId: courseAny.courseId,
          bib: d.bib,
          name: d.name,
          gender: d.gender,
          chipTime: d.chipTime,
          gunTime: d.gunTime,
          chiptimes: d.chiptimes,
          guntimes: d.guntimes,
          paces: d.paces,
          overallRanks: d.overallRanks,
          overallRank: d.overallRank,
          timingPoint: d.timingPoint,
          courseDistanceKm: courseAny.distanceKm,
          category: d.category,
          nationality: d.nationality,
          splits: d.splits,
        }),
      );

      const finishers: AthleteForRanking[] = normalized
        .filter((n) => n.hasFinishChipRead && n.gender)
        .map((n) => ({
          bib: n.bib,
          name: n.name,
          gender: n.gender,
          chipTimeMs: n.chipTimeMs,
          gunTimeMs: n.gunTimeMs,
          vendorAgeGroup: n.vendorAgeGroup,
        }));

      const presetKey = (courseAny as unknown as { ageGroupPreset?: string })
        .ageGroupPreset;
      const buckets = this.bracketCalc.computeAGBuckets(finishers, {
        presetKey,
        raceDay: race.startDate ?? new Date(),
        courseType: courseAny.courseType,
      });

      // For each non-finisher with splits, run prediction against best matching bucket.
      const nonFinishers = normalized.filter(
        (n) => !n.hasFinishChipRead && (n.lastSplitRank ?? Infinity) <= 10 && n.gender && n.vendorAgeGroup,
      );
      for (const nf of nonFinishers) {
        const bucket = buckets.find((b) =>
          nf.vendorAgeGroup?.includes(b.ageGroup),
        );
        if (!bucket) continue;
        const bucketAthletes: AthleteForRanking[] = bucket.athletes.map((a) => ({
          bib: a.bib,
          name: a.name,
          gender: nf.gender,
          chipTimeMs: a.chipTimeMs ?? null,
          gunTimeMs: a.gunTimeMs ?? null,
        }));
        const prediction = this.predictor.predictForAthlete({
          athlete: nf,
          bucketAthletes,
          ageGroup: bucket.ageGroup,
          totalDistanceKm: courseAny.distanceKm,
          raceType: this.mapRaceType(courseAny.courseType, courseAny.distanceKm),
          patternConfidence: nf.lastSplitRank != null && nf.lastSplitRank <= 3 ? 0.9 : 0.6,
        });
        if (prediction) items.push(prediction);
      }
    }
    return items;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async resolveRace(raceId: string): Promise<RaceDocument> {
    if (!Types.ObjectId.isValid(raceId)) {
      throw new NotFoundException('Race không tồn tại');
    }
    const race = await this.raceModel.findById(raceId);
    if (!race) throw new NotFoundException('Race không tồn tại');
    return race;
  }

  private toPodiumResponse(p: PodiumDocument): PodiumResponseDto {
    const d = p as unknown as PodiumDocument & { _id: Types.ObjectId };
    return {
      id: d._id.toString(),
      raceId: d.raceId,
      courseId: d.courseId,
      courseName: d.courseName,
      courseDistanceKm: d.courseDistanceKm,
      ageGroup: d.ageGroup,
      ageGroupKey: d.ageGroupKey,
      ageGroupLabel: d.ageGroupLabel,
      gender: d.gender,
      presetKey: d.presetKey,
      compoundingMode: d.compoundingMode,
      agTopN: d.agTopN,
      podiumType: d.podiumType ?? 'AG',
      athletes: (d.athletes ?? []).map((a) => ({
        bib: a.bib,
        name: a.name,
        rank: a.rank,
        chipTimeMs: a.chipTimeMs,
        chipTime: a.chipTime,
        gunTimeMs: a.gunTimeMs,
        gender: a.gender,
        ageOnRaceDay: a.ageOnRaceDay,
        nationality: a.nationality,
        athleteId: a.athleteId,
        tied: a.tied,
      })),
      state: d.state,
      stateHistory: (d.stateHistory ?? []).map((t) => ({
        fromState: t.fromState,
        toState: t.toState,
        actorId: t.actorId,
        at:
          t.at instanceof Date
            ? t.at.toISOString()
            : new Date(t.at).toISOString(),
        note: t.note,
        evidenceUrl: t.evidenceUrl,
      })),
      computedAt: d.computedAt?.toISOString(),
      lockedAt: d.lockedAt?.toISOString(),
      publishedAt: d.publishedAt?.toISOString(),
      disputedAt: d.disputedAt?.toISOString(),
      finalAt: d.finalAt?.toISOString(),
      latestPdfS3Key: d.latestPdfS3Key,
      latestPdfGeneratedAt: d.latestPdfGeneratedAt?.toISOString(),
      createdAt:
        d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : new Date(d.createdAt ?? Date.now()).toISOString(),
      updatedAt:
        d.updatedAt instanceof Date
          ? d.updatedAt.toISOString()
          : new Date(d.updatedAt ?? Date.now()).toISOString(),
    };
  }

  private toWarningResponse(w: AnomalyWarningDocument): AnomalyWarningResponseDto {
    const d = w as unknown as AnomalyWarningDocument & { _id: Types.ObjectId };
    return {
      id: d._id.toString(),
      raceId: d.raceId,
      courseId: d.courseId,
      bib: d.bib,
      athleteId: d.athleteId,
      athleteName: d.athleteName,
      pattern: d.pattern,
      tier: (d.overrideTier as Tier) ?? d.tier,
      confidence: d.confidence,
      evidence: d.evidence ?? {},
      ackedBy: d.ackedBy,
      ackedAt: d.ackedAt?.toISOString(),
      ackNote: d.ackNote,
      resolution: d.resolution,
      resolvedBy: d.resolvedBy,
      resolvedAt: d.resolvedAt?.toISOString(),
      resolutionNote: d.resolutionNote,
      overrideTier: d.overrideTier,
      transitionHistory: (d.transitionHistory ?? []).map((t) => ({
        action: t.action,
        actorId: t.actorId,
        at:
          t.at instanceof Date
            ? t.at.toISOString()
            : new Date(t.at).toISOString(),
        note: t.note,
        evidenceUrl: t.evidenceUrl,
        priorTier: t.priorTier,
        newTier: t.newTier,
      })),
      createdAt:
        d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : new Date(d.createdAt ?? Date.now()).toISOString(),
      updatedAt:
        d.updatedAt instanceof Date
          ? d.updatedAt.toISOString()
          : new Date(d.updatedAt ?? Date.now()).toISOString(),
    };
  }

  private mapCourseType(
    raw?: string,
  ): 'road' | 'trail' | 'ultra' | 'half_marathon' {
    const t = (raw ?? '').toLowerCase();
    if (t.includes('ultra')) return 'ultra';
    if (t.includes('trail')) return 'trail';
    if (t.includes('half')) return 'half_marathon';
    return 'road';
  }

  private mapRaceType(
    courseType: string | undefined,
    distanceKm: number | undefined,
  ): 'marathon' | 'half_marathon' | 'ultra_trail' | 'default' {
    const t = (courseType ?? '').toLowerCase();
    if (t.includes('ultra') || (distanceKm ?? 0) > 50) return 'ultra_trail';
    if (t.includes('half') || (distanceKm ?? 0) === 21) return 'half_marathon';
    if ((distanceKm ?? 0) === 42) return 'marathon';
    return 'default';
  }

  private async invalidateRaceCache(raceId: string): Promise<void> {
    // SCAN-stream invalidation pattern (port từ articles cache invalidation).
    const stream = this.redis.scanStream({
      match: `awards:race:${raceId}:*`,
      count: 200,
    });
    const keys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: string[]) => {
        for (const k of chunk) keys.push(k);
      });
      stream.on('end', () => resolve());
      stream.on('error', (e) => reject(e));
    });
    if (keys.length) {
      await this.redis.del(...keys).catch(() => undefined);
    }
  }
}
