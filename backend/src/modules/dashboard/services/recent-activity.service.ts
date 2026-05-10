import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
} from '../../audit/schemas/audit-log.schema';
import {
  RecentActivityItemDto,
  RecentActivityResponseDto,
} from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-16/17/18/23 — Recent Activity timeline.
 *
 * Đọc top N latest từ collection `audit_logs`. NOTE: vì F-023 KHÔNG migrate
 * audit log legacy (PAUSE-CODER-V23-AUDIT-MIGRATE), những ngày đầu sau deploy
 * collection có thể trống / ít entry → UI hiển thị empty state.
 */
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

@Injectable()
export class DashboardRecentActivityService {
  private readonly logger = new Logger(DashboardRecentActivityService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly model: Model<AuditLogDocument>,
  ) {}

  async getRecentActivity(limit?: number): Promise<RecentActivityResponseDto> {
    const safeLimit = Math.min(
      Math.max(1, limit ?? DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    try {
      const docs = await this.model
        .find()
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();

      const items: RecentActivityItemDto[] = docs.map((d) => {
        const id = String((d as { _id: unknown })._id);
        const createdAt =
          d.createdAt instanceof Date
            ? d.createdAt.toISOString()
            : (d.createdAt as unknown as string) ?? new Date().toISOString();
        return {
          id,
          actor: {
            userId: d.actor?.userId ?? '',
            displayName: d.actor?.displayName,
            role: d.actor?.role,
          },
          action: d.action,
          entity: {
            type: d.entity?.type ?? '',
            id: d.entity?.id ?? '',
            displayName: d.entity?.displayName,
          },
          metadata: d.metadata,
          createdAt,
        };
      });

      return { items };
    } catch (e) {
      this.logger.warn(`recent-activity fail: ${(e as Error).message}`);
      return { items: [] };
    }
  }
}
