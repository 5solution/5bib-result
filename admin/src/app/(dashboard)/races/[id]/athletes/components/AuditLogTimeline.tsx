'use client';

/**
 * F-014 BR-AS-03 — Audit log timeline (last 5 entries shown).
 *
 * Reads from `editHistory[]` subdoc on race-result row (Manager Option A).
 * No new audit-log module — reuses existing schema field.
 */

import { History } from 'lucide-react';
import type { AthleteEditHistoryEntry } from '../athletes.types';

interface AuditLogTimelineProps {
  entries?: AthleteEditHistoryEntry[];
  /** How many recent entries to show. Default 5. */
  limit?: number;
}

export function AuditLogTimeline({ entries, limit = 5 }: AuditLogTimelineProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        Chưa có thay đổi nào được ghi nhận.
      </div>
    );
  }
  const sliced = [...entries].reverse().slice(0, limit);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <History className="size-3.5" />
        Lịch sử thay đổi ({entries.length})
      </div>
      <ul className="flex flex-col gap-1 text-[11px]">
        {sliced.map((h, i) => (
          <li
            key={`${h.editedAt ?? 'na'}-${i}`}
            className="flex flex-col gap-0.5 rounded border bg-background px-2 py-1.5"
          >
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted-foreground">{h.field ?? 'field'}</span>
              <span>·</span>
              <span className="text-muted-foreground">
                {String(h.oldValue ?? '-')}
              </span>
              <span>→</span>
              <span className="font-semibold">
                {String(h.newValue ?? '-')}
              </span>
              <span className="ml-auto text-muted-foreground">
                {h.editedAt ? new Date(h.editedAt).toLocaleString('vi-VN') : '-'}
              </span>
            </div>
            {h.reason && (
              <div className="text-muted-foreground truncate" title={h.reason}>
                {h.reason}
              </div>
            )}
            {h.editedBy && (
              <div className="text-[10px] text-muted-foreground">
                bởi {h.editedBy}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AuditLogTimeline;
