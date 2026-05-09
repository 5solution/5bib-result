import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../../race-master-data/schemas/race-athlete.schema';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import {
  AGEligibilityReportDto,
  BracketDistributionItemDto,
  VendorCategoryHealthDto,
} from '../dto/ag-eligibility-response.dto';
import {
  AGBracketCalcService,
  normalizeGenderStrict,
} from './ag-bracket-calc.service';
import { defaultPresetFor } from '../constants/ag-presets';

const REDIS_TTL_SECONDS = 60;
const VENDOR_CATEGORY_REGEX = /^(M|F|Nam|Nữ|Nu|Male|Female)\s*\d{1,2}\s*[-–]\s*\d{1,2}/i;

/**
 * F-019 v2 — AG Eligibility Report (Pre-race readiness).
 *
 * Aggregate stats:
 *   - DOB coverage (% athletes có ageOnRaceDay).
 *   - Bracket distribution preview (gender × bracket × count).
 *   - Vendor Category health (populated / empty / malformed).
 *
 * Cache 60s qua Redis key `awards:eligibility:<raceId>`.
 */
@Injectable()
export class AGEligibilityReportService {
  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceAthlete.name)
    private readonly raceAthleteModel: Model<RaceAthleteDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly bracketCalc: AGBracketCalcService,
  ) {}

  async getReport(raceId: string): Promise<AGEligibilityReportDto> {
    if (!Types.ObjectId.isValid(raceId)) {
      throw new NotFoundException('Race không tồn tại');
    }

    const cacheKey = `awards:eligibility:${raceId}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as AGEligibilityReportDto;
      } catch {
        /* fall through */
      }
    }

    const race = await this.raceModel.findById(raceId).lean();
    if (!race) throw new NotFoundException('Race không tồn tại');

    const raceAny = race as unknown as {
      _id: Types.ObjectId;
      startDate?: Date;
      bracketSource?: '5bib' | 'vendor' | 'hybrid';
      courses?: Array<{ courseId: string; courseType?: string }>;
    };
    // Resolve mysql_race_id qua chip_race_configs collection (legacy bridge).
    const linkDoc = await this.raceModel.db
      .collection('chip_race_configs')
      .findOne({ mongo_race_id: raceId });
    const mysqlRaceId =
      (linkDoc?.mysql_race_id as number | undefined) ?? undefined;

    // Step 1: total + withDob from race_athletes (master-data layer).
    let total = 0;
    let withDob = 0;
    let lastSyncedAt: Date | null = null;
    const missingDobBibs: string[] = [];

    if (mysqlRaceId) {
      const [totalCnt, withDobCnt, missingDocs, syncDoc] = await Promise.all([
        this.raceAthleteModel.countDocuments({ mysql_race_id: mysqlRaceId }),
        this.raceAthleteModel.countDocuments({
          mysql_race_id: mysqlRaceId,
          ageOnRaceDay: { $ne: null, $exists: true },
        }),
        this.raceAthleteModel
          .find({
            mysql_race_id: mysqlRaceId,
            ageOnRaceDay: null,
            bib_number: { $ne: null },
          })
          .select('bib_number')
          .limit(100)
          .lean(),
        this.raceAthleteModel
          .findOne({ mysql_race_id: mysqlRaceId })
          .sort({ synced_at: -1 })
          .select('synced_at')
          .lean(),
      ]);
      total = totalCnt;
      withDob = withDobCnt;
      for (const m of missingDocs) {
        if (m.bib_number) missingDobBibs.push(m.bib_number);
      }
      lastSyncedAt = (syncDoc as unknown as { synced_at?: Date })?.synced_at ?? null;
    }

    const withoutDob = Math.max(0, total - withDob);
    const coverage = total > 0 ? withDob / total : 0;
    const readinessLevel: AGEligibilityReportDto['readinessLevel'] =
      coverage >= 0.95 ? 'READY' : coverage >= 0.8 ? 'WARNING' : 'NOT_READY';

    // Step 2: bracket distribution preview using ALL athletes có ageOnRaceDay.
    const bracketDistribution = await this.computeBracketDistribution(
      mysqlRaceId,
      raceAny.startDate ?? new Date(),
      raceAny.courses?.[0]?.courseType,
    );

    // Step 3: vendor Category health from race_results.
    const vendorCategoryHealth = await this.computeVendorCategoryHealth(raceId);

    const report: AGEligibilityReportDto = {
      raceId,
      totalAthletes: total,
      withDob,
      withoutDob,
      coverage: Math.round(coverage * 10000) / 10000,
      readinessLevel,
      missingDobBibs,
      bracketDistribution,
      vendorCategoryHealth,
      bracketSource: raceAny.bracketSource ?? '5bib',
      lastSyncedAt: lastSyncedAt ? lastSyncedAt.toISOString() : undefined,
    };

    await this.redis
      .set(cacheKey, JSON.stringify(report), 'EX', REDIS_TTL_SECONDS)
      .catch(() => undefined);

    return report;
  }

  private async computeBracketDistribution(
    mysqlRaceId: number | undefined,
    raceDay: Date,
    courseType: string | undefined,
  ): Promise<BracketDistributionItemDto[]> {
    if (!mysqlRaceId) return [];

    const docs = await this.raceAthleteModel
      .find({
        mysql_race_id: mysqlRaceId,
        ageOnRaceDay: { $ne: null, $gte: 0 },
        gender: { $ne: null },
      })
      .select('ageOnRaceDay gender')
      .lean();

    const preset = this.bracketCalc.resolvePreset(
      undefined,
      courseType,
      undefined,
    );

    const counts = new Map<string, number>();
    for (const d of docs) {
      const dAny = d as unknown as { ageOnRaceDay?: number; gender?: string };
      const g = normalizeGenderStrict(dAny.gender);
      if (!g) continue;
      const age = dAny.ageOnRaceDay;
      if (age == null || age < 0) continue;
      const bracket = this.bracketCalc.assignBracket(age, g, preset);
      if (!bracket) continue;
      const key = `${g}__${bracket.key}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const result: BracketDistributionItemDto[] = [];
    for (const [key, count] of counts.entries()) {
      const [gender, bracketKey] = key.split('__');
      result.push({
        ageGroup: bracketKey,
        gender: gender as 'M' | 'F',
        count,
      });
    }
    result.sort((a, b) => {
      if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;
      return a.ageGroup.localeCompare(b.ageGroup);
    });
    return result;
  }

  private async computeVendorCategoryHealth(
    raceId: string,
  ): Promise<VendorCategoryHealthDto> {
    const docs = await this.resultModel
      .find({ raceId })
      .select('category')
      .lean();

    let populated = 0;
    let empty = 0;
    let malformed = 0;
    for (const d of docs) {
      const cat = ((d as unknown as { category?: string }).category ?? '').trim();
      if (!cat) {
        empty += 1;
        continue;
      }
      if (VENDOR_CATEGORY_REGEX.test(cat)) {
        populated += 1;
      } else {
        malformed += 1;
      }
    }

    return { populated, empty, malformed };
  }

  /**
   * Manual cache flush — invoked after recompute để force fresh report.
   */
  async invalidate(raceId: string): Promise<void> {
    await this.redis.del(`awards:eligibility:${raceId}`).catch(() => undefined);
  }
}
