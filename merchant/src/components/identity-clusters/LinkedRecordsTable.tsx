/**
 * F-049 — Linked athlete records table cho cluster detail page.
 *
 * BR-49-10 / Field Source Table — Tên giải (truncate 40 + tooltip) /
 * Số BIB (font-mono) / Tên VĐV / Đồng bộ lúc / Hành động (Phân tách bản ghi này).
 *
 * Hand-pick field mapping audit: row data PRESERVES raceName + bibNumber from
 * F-049 backend enrichment via spread `{...r}` pattern.
 */

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTION_LABEL,
  truncateRaceName,
} from "@/lib/identity-cluster-labels";

export interface LinkedRecord {
  mysql_race_id: number;
  athletes_id: number;
  bib_number: string | null;
  mongoRaceId: string | null;
  mongoBib: string | null;
  fullName: string | null;
  // F-049 enrichment fields
  raceName?: string;
  bibNumber?: string;
}

interface Props {
  records: LinkedRecord[];
  /** Tech-mode adds extra columns (mongoRaceId raw). */
  techMode: boolean;
  /** Single-record split callback. Disabled if total records ≤ 1. */
  onSplitRecord?: (athletesId: number, displayName: string) => void;
  /** Disable action buttons during pending mutation. */
  disabled?: boolean;
}

export function LinkedRecordsTable({
  records,
  techMode,
  onSplitRecord,
  disabled = false,
}: Props) {
  const canSplit = records.length > 1;

  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
        Chưa liên kết giải nào
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Tên giải</TableHead>
            <TableHead className="text-left">Số BIB</TableHead>
            <TableHead className="text-left">Tên VĐV</TableHead>
            {techMode && (
              <>
                <TableHead className="text-left">MySQL Race ID</TableHead>
                <TableHead className="text-left">Athletes ID</TableHead>
                <TableHead className="text-left">Mongo Race Ref</TableHead>
              </>
            )}
            {onSplitRecord && (
              <TableHead className="text-right">Hành động</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <RecordRow
              key={`${r.mysql_race_id}-${r.athletes_id}`}
              record={r}
              techMode={techMode}
              canSplit={canSplit}
              onSplit={onSplitRecord}
              disabled={disabled}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RecordRow({
  record,
  techMode,
  canSplit,
  onSplit,
  disabled,
}: {
  record: LinkedRecord;
  techMode: boolean;
  canSplit: boolean;
  onSplit?: (athletesId: number, displayName: string) => void;
  disabled: boolean;
}) {
  const displayName =
    record.bibNumber ?? record.bib_number ?? `#${record.athletes_id}`;
  const displayAthleteName = record.fullName ?? "—";
  const [confirming, setConfirming] = useState(false);

  return (
    <TableRow>
      <TableCell title={record.raceName ?? undefined} className="max-w-xs">
        {record.raceName ? (
          <span className="truncate font-medium text-stone-900">
            {truncateRaceName(record.raceName)}
          </span>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-stone-800">
        {record.bibNumber ?? record.bib_number ?? "—"}
      </TableCell>
      <TableCell>{displayAthleteName}</TableCell>
      {techMode && (
        <>
          <TableCell className="font-mono text-xs text-stone-500">
            {record.mysql_race_id}
          </TableCell>
          <TableCell className="font-mono text-xs text-stone-500">
            {record.athletes_id}
          </TableCell>
          <TableCell className="font-mono text-xs text-stone-500">
            {record.mongoRaceId
              ? record.mongoRaceId.substring(0, 8) + "…"
              : "—"}
          </TableCell>
        </>
      )}
      {onSplit && (
        <TableCell className="text-right">
          {confirming ? (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setConfirming(false)}
                disabled={disabled}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => {
                  onSplit(record.athletes_id, `${displayName} - ${displayAthleteName}`);
                  setConfirming(false);
                }}
                disabled={disabled}
              >
                Xác nhận
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setConfirming(true)}
              disabled={!canSplit || disabled}
              title={
                !canSplit
                  ? "Phải giữ ít nhất 1 bản ghi"
                  : ACTION_LABEL.splitOneRecord
              }
              className="text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              {ACTION_LABEL.splitOneRecord}
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
