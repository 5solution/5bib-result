import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import {
  OpsAuditLog,
  OpsAuditLogDocument,
} from '../schemas/ops-audit-log.schema';
import { AuditAction } from '../common/constants';

export interface AuditLogInput {
  event_id: string | Types.ObjectId;
  user_id: string | Types.ObjectId;
  action: AuditAction | string;
  entity_type: string; // 'ops_supply_orders'
  entity_id: string | Types.ObjectId;
  from_state?: string;
  to_state?: string;
  payload?: Record<string, unknown>;
  request?: Request; // optional — để extract ip/user-agent
}

/**
 * AuditService — mọi mutation state machine gọi `log(...)` sau khi commit thành công.
 *
 * Thiết kế:
 *  - Không throw ra ngoài nếu ghi log fail → dùng Logger.warn, không làm hỏng main flow.
 *  - Fire-and-forget optional (caller có thể `await` hoặc không).
 *  - TTL 1 năm (index đã định nghĩa trong schema).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(OpsAuditLog.name)
    private readonly auditModel: Model<OpsAuditLogDocument>,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      const ip = this.extractIp(input.request);
      const userAgent = input.request?.headers['user-agent'];

      await this.auditModel.create({
        event_id: new Types.ObjectId(String(input.event_id)),
        user_id: new Types.ObjectId(String(input.user_id)),
        action: input.action,
        entity_type: input.entity_type,
        entity_id: new Types.ObjectId(String(input.entity_id)),
        from_state: input.from_state,
        to_state: input.to_state,
        payload: input.payload ?? {},
        ip,
        user_agent: typeof userAgent === 'string' ? userAgent : undefined,
      });
    } catch (err) {
      this.logger.warn(
        `Audit log failed for ${input.action} ${input.entity_type}:${String(input.entity_id)} — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private extractIp(req?: Request): string | undefined {
    if (!req) return undefined;
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') {
      return fwd.split(',')[0]?.trim();
    }
    if (Array.isArray(fwd) && fwd.length > 0) {
      return fwd[0];
    }
    return req.ip;
  }
}
