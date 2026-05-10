import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  ResultClaim,
  ResultClaimDocument,
} from '../../race-result/schemas/result-claim.schema';
import {
  Reconciliation,
  ReconciliationDocument,
} from '../../reconciliation/schemas/reconciliation.schema';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  PendingTaskGroupDto,
  PendingTasksResponseDto,
} from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-13/14/15/22 — Pending Tasks panel.
 *
 * 4 nhóm cố định MVP:
 *  1. Khiếu nại chờ xử lý — ResultClaim.status='pending'
 *  2. Đối soát chờ ký — Reconciliation.status ∈ {draft, ready, flagged}
 *  3. Master Data chờ sync — Race pre_race chưa có cache `master:athlete:bib:`
 *  4. Chip mapping chưa hoàn thành — Race pre_race + (placeholder, MVP đếm 0)
 *
 * Kết quả cache 60s (BR-DASH-14) bằng key `dashboard:pending-tasks`.
 * BR-DASH-22 — tổng = 0 → UI render empty state, vẫn show section.
 */
const CACHE_KEY = 'dashboard:pending-tasks';
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class DashboardPendingTasksService {
  private readonly logger = new Logger(DashboardPendingTasksService.name);

  constructor(
    @InjectModel(ResultClaim.name)
    private readonly claimModel: Model<ResultClaimDocument>,
    @InjectModel(Reconciliation.name)
    private readonly reconModel: Model<ReconciliationDocument>,
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getPendingTasks(): Promise<PendingTasksResponseDto> {
    const cached = await this.readCache();
    if (cached) return cached;

    const fresh = await this.compute();
    await this.writeCache(fresh);
    return fresh;
  }

  private async readCache(): Promise<PendingTasksResponseDto | null> {
    try {
      const raw = await this.redis.get(CACHE_KEY);
      return raw ? (JSON.parse(raw) as PendingTasksResponseDto) : null;
    } catch (e) {
      this.logger.warn(`pending-tasks cache read fail: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCache(payload: PendingTasksResponseDto): Promise<void> {
    try {
      await this.redis.set(
        CACHE_KEY,
        JSON.stringify(payload),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(`pending-tasks cache write fail: ${(e as Error).message}`);
    }
  }

  private async compute(): Promise<PendingTasksResponseDto> {
    const [
      claimsCount,
      reconCount,
      masterDataCount,
      chipCount,
    ] = await Promise.all([
      this.countClaims(),
      this.countRecon(),
      this.countMasterDataPending(),
      this.countChipPending(),
    ]);

    const groups: PendingTaskGroupDto[] = [
      {
        key: 'claims',
        label: 'Khiếu nại chờ xử lý',
        count: claimsCount,
        href: '/claims?status=pending',
      },
      {
        key: 'recon',
        label: 'Đối soát chờ ký',
        count: reconCount,
        href: '/reconciliation?status=draft',
      },
      {
        key: 'master_data',
        label: 'Master Data chờ sync',
        count: masterDataCount,
        href: '/races?filter=master_data_pending',
      },
      {
        key: 'chip',
        label: 'Chip mapping chưa hoàn thành',
        count: chipCount,
        href: '/races?filter=chip_pending',
      },
    ];

    const total = groups.reduce((sum, g) => sum + g.count, 0);
    return { groups, total };
  }

  private async countClaims(): Promise<number> {
    try {
      return await this.claimModel.countDocuments({ status: 'pending' });
    } catch (e) {
      this.logger.warn(`countClaims fail: ${(e as Error).message}`);
      return 0;
    }
  }

  private async countRecon(): Promise<number> {
    try {
      return await this.reconModel.countDocuments({
        status: { $in: ['draft', 'ready', 'flagged'] },
      });
    } catch (e) {
      this.logger.warn(`countRecon fail: ${(e as Error).message}`);
      return 0;
    }
  }

  private async countMasterDataPending(): Promise<number> {
    try {
      const races = await this.raceModel
        .find({ status: 'pre_race' })
        .select('_id')
        .lean();
      let pending = 0;
      for (const r of races) {
        const raceId = String((r as { _id: unknown })._id);
        const len = await this.redis.hlen(`master:athlete:bib:${raceId}`);
        if (!len || Number(len) === 0) pending += 1;
      }
      return pending;
    } catch (e) {
      this.logger.warn(`countMasterDataPending fail: ${(e as Error).message}`);
      return 0;
    }
  }

  private async countChipPending(): Promise<number> {
    // MVP: chưa có nguồn dữ liệu chuẩn cho chip-verification %.
    // Trả 0 — sau ship F-023 có thể hookup ChipVerificationModule khi expose
    // count endpoint. Defer.
    return 0;
  }
}
