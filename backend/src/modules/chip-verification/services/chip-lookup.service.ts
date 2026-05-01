import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  ChipVerification,
  ChipVerificationDocument,
  ChipVerificationResult,
} from '../schemas/chip-verification.schema';
import { ChipMappingService } from './chip-mapping.service';
import { ChipRedisKeys } from '../utils/redis-keys';
import { ChipLookupResponseDto } from '../dto/chip-lookup.dto';
import { normalizeChipId } from '../utils/normalize';
import { RaceAthleteLookupService } from '../../race-master-data/services/race-athlete-lookup.service';
import { RaceAthletePublicDto } from '../../race-master-data/dto/race-athlete-public.dto';

/**
 * v1.3 — Core lookup orchestration. Delegates ALL athlete data resolution
 * to `RaceAthleteLookupService` (master data DI). KHÔNG còn TypeORM,
 * KHÔNG còn cache service riêng.
 *
 * Flow:
 *   1. chip_id → bib_number   (Mongoose chip_mappings — race-scoped, BR-08)
 *   2. bib_number → athlete   (master data — Redis → Mongo → MySQL fallback)
 *   3. is_first_verify SETNX  (Redis atomic, MUST-DO #3)
 *   4. classify result + insert audit log
 *
 * W-5 fix: `@Optional()` inject `RaceAthleteLookupService`. Khi
 * `PLATFORM_DB_HOST` missing → `RaceMasterDataModule` không load → service
 * undefined. Throw 503 thay vì TypeError crash.
 *
 * W-4 fix: TTL 30 ngày trên `chip:first-verify:{race}:{athleteId}` keys —
 * tránh leak vĩnh viễn (94K athletes × 195 races = ~18M keys nếu không
 * expire).
 */
@Injectable()
export class ChipLookupService {
  private readonly logger = new Logger(ChipLookupService.name);
  /** W-4: 30 days TTL cho first-verify SETNX. Race ended → keys age out. */
  private static readonly FIRST_VERIFY_TTL_SECONDS = 30 * 24 * 60 * 60;

  constructor(
    @InjectModel(ChipVerification.name)
    private readonly verificationModel: Model<ChipVerificationDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly mappingService: ChipMappingService,
    @Optional()
    private readonly raceAthleteLookup: RaceAthleteLookupService | null,
  ) {
    if (!this.raceAthleteLookup) {
      this.logger.warn(
        'RaceAthleteLookupService not available (PLATFORM_DB_HOST missing?). ' +
          'Chip-verify lookup sẽ trả 503 cho tới khi master-data module load.',
      );
    }
  }

  private requireRaceAthleteLookup(): RaceAthleteLookupService {
    if (!this.raceAthleteLookup) {
      throw new InternalServerErrorException(
        'Race master data service unavailable — kiểm tra PLATFORM_DB_HOST env.',
      );
    }
    return this.raceAthleteLookup;
  }

  async lookup(
    raceId: number,
    rawChipId: string,
    deviceLabel: string | undefined,
    ipAddress: string | undefined,
  ): Promise<ChipLookupResponseDto> {
    const chipId = normalizeChipId(rawChipId);

    // 1. Resolve chip → BIB via Mongoose mapping (BR-08 race-scoped query)
    const mapping = await this.mappingService.findByChipId(raceId, chipId);

    if (!mapping) {
      return this.recordAndReturn({
        raceId,
        chipId,
        bibNumber: null,
        athletesId: null,
        result: 'CHIP_NOT_FOUND',
        deviceLabel,
        ipAddress,
        athleteSnapshot: null,
        courseSnapshot: null,
      });
    }

    if (mapping.status === 'DISABLED') {
      return this.recordAndReturn({
        raceId,
        chipId,
        bibNumber: mapping.bib_number,
        athletesId: null,
        result: 'DISABLED',
        deviceLabel,
        ipAddress,
        athleteSnapshot: null,
        courseSnapshot: null,
      });
    }

    // 2. Resolve BIB → athlete via master data (3-tier cache internal).
    // W-5: requireRaceAthleteLookup() throw 503 nếu module không load
    // (graceful degrade, không TypeError crash).
    const lookupSvc = this.requireRaceAthleteLookup();
    const athlete = await lookupSvc.lookupByBib(raceId, mapping.bib_number);

    if (!athlete) {
      // Mapping exists but no athlete with this BIB yet → BIB_UNASSIGNED
      return this.recordAndReturn({
        raceId,
        chipId,
        bibNumber: mapping.bib_number,
        athletesId: null,
        result: 'BIB_UNASSIGNED',
        deviceLabel,
        ipAddress,
        athleteSnapshot: null,
        courseSnapshot: null,
      });
    }

    // 3. is_first_verify atomic SETNX — independent dimension
    //    from racekit_received. Tracks "first time chip verify system saw
    //    this athlete" for stats/audit only.
    // W-4 fix: 30 days TTL — race ended → keys auto-expire. Tránh leak
    //          ~18M permanent keys (94K athletes × 195 races scale).
    const firstKey = ChipRedisKeys.firstVerify(raceId, athlete.athletes_id);
    const firstResult = await this.redis.set(
      firstKey,
      '1',
      'EX',
      ChipLookupService.FIRST_VERIFY_TTL_SECONDS,
      'NX',
    );
    const isFirst = firstResult === 'OK';

    // 4. Result classification — racekit_received from master data is the
    //    SOURCE OF TRUTH. If athlete already picked up at Bàn 1 legacy,
    //    Bàn 2 must show ALREADY_PICKED_UP regardless of whether this is
    //    the first chip verify or a duplicate.
    let result: ChipVerificationResult = 'FOUND';
    if (athlete.racekit_received) {
      result = 'ALREADY_PICKED_UP';
    }

    return this.recordAndReturn({
      raceId,
      chipId,
      bibNumber: mapping.bib_number,
      athletesId: athlete.athletes_id,
      result,
      isFirst,
      deviceLabel,
      ipAddress,
      athleteSnapshot: athlete,
      courseSnapshot: athlete.course_name,
    });
  }

  /** Insert audit doc + return DTO. */
  private async recordAndReturn(input: {
    raceId: number;
    chipId: string;
    bibNumber: string | null;
    athletesId: number | null;
    result: ChipVerificationResult;
    isFirst?: boolean;
    deviceLabel?: string;
    ipAddress?: string;
    athleteSnapshot: RaceAthletePublicDto | null;
    courseSnapshot: string | null;
  }): Promise<ChipLookupResponseDto> {
    const verifiedAt = new Date();
    const isFirst = input.isFirst ?? false;
    const snapshot = input.athleteSnapshot;

    await this.verificationModel.create({
      mysql_race_id: input.raceId,
      chip_id: input.chipId,
      bib_number: input.bibNumber,
      athletes_id: input.athletesId,
      result: input.result,
      is_first_verify: isFirst && input.result === 'FOUND',
      device_label: input.deviceLabel,
      ip_address: input.ipAddress,
      athlete_name_snapshot: snapshot?.display_name ?? null,
      bib_number_snapshot: input.bibNumber,
      course_name_snapshot: input.courseSnapshot,
    });

    return {
      result: input.result,
      bib_number: input.bibNumber,
      name: snapshot?.display_name ?? null,
      bib_name: snapshot?.bib_name ?? null,
      full_name: snapshot?.full_name ?? null,
      course_name: input.courseSnapshot,
      gender: snapshot?.gender ?? null,
      team: snapshot?.club ?? null,
      // Vật phẩm racekit từ RaceAthletePublicDto.items (mapped từ
      // athlete_subinfo.achievements bởi RaceMasterDataModule).
      items: snapshot?.items ?? null,
      last_status: snapshot?.last_status ?? null,
      racekit_received: snapshot?.racekit_received ?? false,
      is_first_verify: isFirst && input.result === 'FOUND',
      verified_at: verifiedAt,
    };
  }

  /** Recent N verifications for kiosk history list. */
  async recent(
    raceId: number,
    limit: number,
  ): Promise<{
    items: {
      bib_number: string | null;
      name: string | null;
      course_name: string | null;
      result: ChipVerificationResult;
      verified_at: Date;
      device_label: string | null;
      is_first_verify: boolean;
    }[];
  }> {
    const cap = Math.min(Math.max(1, limit), 50);
    const docs = await this.verificationModel
      .find({ mysql_race_id: raceId })
      .sort({ verified_at: -1 })
      .limit(cap)
      .lean<
        (ChipVerification & { verified_at: Date })[]
      >()
      .exec();

    return {
      items: docs.map((d) => ({
        bib_number: d.bib_number_snapshot ?? d.bib_number ?? null,
        name: d.athlete_name_snapshot ?? null,
        course_name: d.course_name_snapshot ?? null,
        result: d.result,
        verified_at: d.verified_at,
        device_label: d.device_label ?? null,
        is_first_verify: d.is_first_verify,
      })),
    };
  }
}
