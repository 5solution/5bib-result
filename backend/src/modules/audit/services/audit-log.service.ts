import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

/**
 * F-023 BR-DASH-23 — AuditLogService.emit() helper.
 *
 * Gọi sau MỌI mutation cần track. Gọi best-effort:
 *  - Nếu DB fail (Mongo down, schema invalid, ...) → LOG warn nhưng KHÔNG throw,
 *    đảm bảo audit failure KHÔNG làm rollback business mutation.
 *  - Audit log starts at F-023 deploy timestamp (PAUSE-CODER-V23-AUDIT-MIGRATE):
 *    KHÔNG migrate retroactive cho legacy mutation, chỉ track từ thời điểm
 *    feature 023 ship lên prod.
 */
export interface AuditEmitPayload {
  actor: {
    userId: string;
    displayName?: string;
    role?: string;
  };
  action: string;
  entity: {
    type: string;
    id: string;
    displayName?: string;
  };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly model: Model<AuditLogDocument>,
  ) {}

  /**
   * Phát một audit event. KHÔNG throw — caller không cần wrap try/catch.
   * Caller gọi pattern:
   * ```ts
   * await this.audit.emit({ actor, action: 'race.publish', entity, metadata });
   * ```
   */
  async emit(payload: AuditEmitPayload): Promise<void> {
    try {
      await this.model.create({
        actor: payload.actor,
        action: payload.action,
        entity: payload.entity,
        metadata: payload.metadata,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[audit-log] emit fail action=${payload.action} entity=${payload.entity.type}:${payload.entity.id} err=${msg}`,
      );
    }
  }
}
