import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * F-067 Group Z — DTOs for `GET /api/admin/contracts/:id/history`.
 *
 * Wrapper around `audit_logs` collection entries scoped to one contract.
 * Schema matches `AuditLog` (F-023) — see schemas/audit-log.schema.ts. The
 * response intentionally exposes a *typed view* of `metadata` (including the
 * F-067 `diff` payload) so the admin UI can render delta cards without
 * speculating about field shape.
 */

export class GetHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Số entry tối đa trả về. Mặc định 50, tối đa 200.',
    minimum: 1,
    maximum: 200,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class AuditActorDto {
  @ApiProperty({ description: 'Logto userId (hoặc "admin" cho TD-CONTRACTS-ACTOR-001).' })
  userId!: string;

  @ApiPropertyOptional({ description: 'Snapshot display name tại thời điểm action.' })
  displayName?: string;

  @ApiPropertyOptional({ description: 'Snapshot role (admin/operator/...).' })
  role?: string;
}

export class AuditEntryDto {
  @ApiProperty({ description: 'Mongo ObjectId stringified.' })
  id!: string;

  @ApiProperty({
    description: 'Action verb (e.g. contract.update.force, contract.docRegenFail).',
  })
  action!: string;

  @ApiProperty({ type: AuditActorDto })
  actor!: AuditActorDto;

  @ApiProperty({ description: 'ISO 8601 timestamp.' })
  createdAt!: string;

  @ApiPropertyOptional({
    description:
      'Payload tuỳ action. F-067 thêm `diff` field (changedFields, lineItems.added/removed/modified, totalAmount delta, vatRate, …).',
    type: Object,
  })
  metadata?: Record<string, unknown>;
}

export class ContractHistoryResponseDto {
  @ApiProperty({ type: [AuditEntryDto], description: 'Sorted createdAt DESC.' })
  entries!: AuditEntryDto[];

  @ApiProperty({ description: 'Số entry trả về (≤ limit).' })
  total!: number;
}
