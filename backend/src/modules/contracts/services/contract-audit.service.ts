import { Injectable, Logger, Optional } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service';
import type { ContractUpdateDiff } from '../utils/contract-diff.util';

/**
 * F-067 — Contract domain wrapper around `AuditLogService`.
 *
 * Two reasons for the wrapper:
 *  1. Centralize the contract-specific actor enrichment (TD-CONTRACTS-ACTOR-001
 *     keeps `userId='admin'` until JWT extraction lands).
 *  2. Type-safe surface for the `diff` payload so callers cannot accidentally
 *     drop it into `metadata` with the wrong shape (BR-67-11/13).
 *
 * KHÔNG re-implement persistence — defers to `AuditLogService.emit` which is
 * already best-effort (no-throw) per F-023. If `AuditLogService` is missing
 * (e.g. test bench), this wrapper logs warn + returns silently.
 */

/**
 * Known contract-domain audit actions. Widened to `string` at the emit input
 * level (QC F-067 rework Item 3) so this wrapper can route ALL existing
 * `emitAudit()` call sites (contract.create / .cancel / .activate /
 * .linkMysql / .acceptanceReport* / .paymentRequestUpsert / .markPaid /
 * .delete / .convertFromQuotation / .generateDocument / quotation.* …) —
 * not just the 3 F-067 actions. Centralization is the point.
 */
export type ContractAuditAction =
  | 'contract.update'
  | 'contract.update.force'
  | 'contract.docRegenFail'
  | string;

export interface ContractAuditEmitInput {
  contractId: string;
  /** Actor for the audit trail. PAUSE-67-CODER-01 → keeps `'admin'` until
   *  Logto userId attribution lands (TD-CONTRACTS-ACTOR-001). */
  actorId: string;
  action: ContractAuditAction;
  displayName?: string;
  /** Existing F-024 metadata (previousStatus, editedFields, error, …). */
  metadata?: Record<string, unknown>;
  /** Optional structured diff (BR-67-11). Sugar — equivalent to passing
   *  `metadata.diff` directly. Kept for type-safe diff payloads. */
  diff?: ContractUpdateDiff;
}

@Injectable()
export class ContractAuditService {
  private readonly logger = new Logger(ContractAuditService.name);

  constructor(@Optional() private readonly auditLog?: AuditLogService) {}

  /** Emit a contract-domain audit log entry. Never throws — Logger.warn on
   *  any unexpected failure (matches existing emitAudit contract). */
  async emit(input: ContractAuditEmitInput): Promise<void> {
    if (!this.auditLog) {
      this.logger.warn(
        `[F-067] AuditLogService not bound — skip emit action=${input.action} contract=${input.contractId}`,
      );
      return;
    }
    const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
    if (input.diff) metadata.diff = input.diff;
    try {
      await this.auditLog.emit({
        actor: { userId: input.actorId },
        action: input.action,
        entity: {
          type: 'contract',
          id: input.contractId,
          displayName: input.displayName,
        },
        metadata,
      });
    } catch (err) {
      // AuditLogService.emit is already swallow-throw, but defensive log here
      // covers any future regression where someone removes the inner guard.
      this.logger.warn(
        `[F-067] audit emit fail action=${input.action} contract=${input.contractId} err=${(err as Error).message}`,
      );
    }
  }
}
