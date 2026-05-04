import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TimingAlert,
  TimingAlertDocument,
} from '../schemas/timing-alert.schema';

/**
 * Phase 3 — Auto migration on app startup.
 *
 * **Migrations:**
 * 1. Drop legacy unique index `race_id_1_bib_number_1` (Phase 1B-2 schema).
 *    Replace với compound `(race_id, bib_number, missing_point)` partial OPEN
 *    để hỗ trợ multi-alert per BIB (PHANTOM + MIDDLE_GAP).
 *
 *    Bug nếu KHÔNG drop: `findOneAndUpdate` upsert alert thứ 2 cho cùng BIB
 *    (different missing_point) → MongoServerError E11000 → poll cycle silently
 *    skip alert. QC R2 BLOCKER.
 *
 * 2. Backfill `detection_type='PHANTOM'` cho alert cũ không có field này.
 *    Default ở schema chỉ apply lúc create — alert cũ giữ undefined → admin
 *    UI render thiếu badge. QC R3 HIGH.
 *
 * **Safety:** idempotent — `dropIndex` throw nếu không tồn tại (catch),
 * `updateMany` chỉ ảnh hưởng docs thiếu field.
 */
@Injectable()
export class TimingAlertMigrationsService implements OnModuleInit {
  private readonly logger = new Logger(TimingAlertMigrationsService.name);

  constructor(
    @InjectModel(TimingAlert.name)
    private readonly alertModel: Model<TimingAlertDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dropLegacyUniqueIndex();
    await this.backfillDetectionType();
  }

  /**
   * Drop `race_id_1_bib_number_1` index (legacy Phase 1B-2). Mongoose tự
   * tạo index mới `(race_id, bib_number, missing_point)` từ schema definition.
   */
  private async dropLegacyUniqueIndex(): Promise<void> {
    try {
      const indexes = await this.alertModel.collection.indexes();
      const legacy = indexes.find((i) => i.name === 'race_id_1_bib_number_1');
      if (!legacy) {
        this.logger.log(
          '[migration] legacy index `race_id_1_bib_number_1` đã không tồn tại — skip',
        );
        return;
      }
      await this.alertModel.collection.dropIndex('race_id_1_bib_number_1');
      this.logger.warn(
        '[migration] DROPPED legacy unique index `race_id_1_bib_number_1` — multi-alert per BIB enabled',
      );
    } catch (err) {
      // Index có thể đã drop hoặc collection rỗng — log but không block startup
      const msg = (err as Error).message;
      if (msg.includes('index not found') || msg.includes('ns not found')) {
        this.logger.log(`[migration] dropIndex no-op: ${msg}`);
        return;
      }
      this.logger.error(`[migration] dropLegacyUniqueIndex failed: ${msg}`);
    }
  }

  /**
   * Backfill `detection_type='PHANTOM'` cho alerts cũ. Idempotent — chỉ
   * update docs thiếu field. Race day collection có thể có 10K-50K rows
   * tùy traffic, KHÔNG block startup nếu fail (log + continue).
   */
  private async backfillDetectionType(): Promise<void> {
    try {
      const result = await this.alertModel
        .updateMany(
          { detection_type: { $exists: false } },
          { $set: { detection_type: 'PHANTOM' } },
        )
        .exec();
      if (result.modifiedCount > 0) {
        this.logger.warn(
          `[migration] backfilled detection_type='PHANTOM' cho ${result.modifiedCount} alerts cũ`,
        );
      } else {
        this.logger.log('[migration] detection_type backfill no-op (mọi alert đã có field)');
      }
    } catch (err) {
      this.logger.error(
        `[migration] backfillDetectionType failed: ${(err as Error).message}`,
      );
    }
  }
}
