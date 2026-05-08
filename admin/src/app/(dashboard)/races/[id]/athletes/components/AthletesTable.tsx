'use client';

/**
 * F-014 BR-AS-06/12 — Athletes table.
 *
 * Server-paginated 50/page (page-based, NOT infinite scroll — admin
 * power-users want explicit control per Manager tech approach). Selection
 * checkbox per row + select-all in header.
 */

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AthleteRow } from './AthleteRow';
import { ATHLETES_VN } from '../athletes.microcopy';
import { ATHLETES_PAGE_SIZE, STATUS_PRIORITY } from '../athletes.constant';
import type { AthleteWithStatus } from '../athletes.types';

interface AthletesTableProps {
  rows: AthleteWithStatus[];
  total: number;
  page: number;
  isLoading: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onSetPage: (n: number) => void;
  onView: (row: AthleteWithStatus) => void;
  onEdit: (row: AthleteWithStatus) => void;
  onChangeStatus: (row: AthleteWithStatus) => void;
  onContact: (row: AthleteWithStatus) => void;
  onAuditLog: (row: AthleteWithStatus) => void;
}

export function AthletesTable(props: AthletesTableProps) {
  const {
    rows,
    total,
    page,
    isLoading,
    selected,
    onToggleSelect,
    onToggleSelectAll,
    onSetPage,
    onView,
    onEdit,
    onChangeStatus,
    onContact,
    onAuditLog,
  } = props;

  // BR-AS-07 — apply static priority sort by derivedStatus, then BIB asc.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.derivedStatus];
      const pb = STATUS_PRIORITY[b.derivedStatus];
      if (pa !== pb) return pa - pb;
      const ba = String(a.bib ?? a.Bib ?? '');
      const bb = String(b.bib ?? b.Bib ?? '');
      // Numeric-aware sort for BIBs
      const na = parseInt(ba, 10);
      const nb = parseInt(bb, 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return ba.localeCompare(bb);
    });
  }, [rows]);

  const allIdsOnPage = useMemo(
    () =>
      sorted
        .map((r) => r._id ?? `${r.raceId ?? ''}-${r.bib ?? r.Bib ?? ''}`)
        .filter(Boolean) as string[],
    [sorted],
  );
  const allSelectedOnPage =
    allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selected.has(id));

  const totalPages = Math.max(1, Math.ceil(total / ATHLETES_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelectedOnPage}
                onCheckedChange={() => onToggleSelectAll(allIdsOnPage)}
                aria-label="Chọn toàn trang"
              />
            </TableHead>
            <TableHead className="w-20">{ATHLETES_VN.colBib}</TableHead>
            <TableHead>{ATHLETES_VN.colName}</TableHead>
            <TableHead className="hidden md:table-cell">
              {ATHLETES_VN.colCourse}
            </TableHead>
            <TableHead className="hidden sm:table-cell w-16 text-center">
              {ATHLETES_VN.colGender}
            </TableHead>
            <TableHead className="hidden lg:table-cell w-20">
              {ATHLETES_VN.colAg}
            </TableHead>
            <TableHead className="w-32">{ATHLETES_VN.colStatus}</TableHead>
            <TableHead className="hidden md:table-cell w-28">
              {ATHLETES_VN.colChipTime}
            </TableHead>
            <TableHead className="text-right w-48">
              {ATHLETES_VN.colActions}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? [0, 1, 2, 3, 4, 5].map((i) => (
                <TableRow key={`skeleton-${i}`}>
                  <td colSpan={9} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </TableRow>
              ))
            : sorted.map((row) => {
                const id =
                  row._id ?? `${row.raceId ?? ''}-${row.bib ?? row.Bib ?? ''}`;
                return (
                  <AthleteRow
                    key={id}
                    row={row}
                    selected={selected.has(id)}
                    onToggleSelect={() => onToggleSelect(id)}
                    onView={() => onView(row)}
                    onEdit={() => onEdit(row)}
                    onChangeStatus={() => onChangeStatus(row)}
                    onContact={() => onContact(row)}
                    onAuditLog={() => onAuditLog(row)}
                  />
                );
              })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>
          Trang {page}/{totalPages} · {total} VĐV
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            data-testid="athletes-page-prev"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            data-testid="athletes-page-next"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AthletesTable;
