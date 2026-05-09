'use client';

/**
 * F-014 — Single athlete table row.
 *
 * Renders 5 quick actions (BR-AS-12): View / Edit / Change status /
 * Contact / Audit log. Selection checkbox for bulk actions (BR-AS-15).
 *
 * Pure presentational — all callbacks come from parent.
 */

import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, ArrowRightLeft, Mail, History } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import {
  getBib,
  getCourseId,
  getName,
  getChipTime,
  getGender,
  type AthleteWithStatus,
} from '../athletes.types';
import { ATHLETES_VN } from '../athletes.microcopy';

interface AthleteRowProps {
  row: AthleteWithStatus;
  selected: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onEdit: () => void;
  onChangeStatus: () => void;
  onContact: () => void;
  onAuditLog: () => void;
}

export function AthleteRow(props: AthleteRowProps) {
  const {
    row,
    selected,
    onToggleSelect,
    onView,
    onEdit,
    onChangeStatus,
    onContact,
    onAuditLog,
  } = props;

  const bib = getBib(row);
  const name = getName(row);
  const courseId = getCourseId(row);
  const chipTime = getChipTime(row);
  const gender = getGender(row);
  const ag = String(row.category ?? row.Category ?? '');

  return (
    <TableRow data-testid={`athlete-row-${bib}`}>
      <TableCell className="py-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`Chọn VĐV BIB ${bib}`}
        />
      </TableCell>
      <TableCell className="font-mono text-sm font-semibold py-3">
        {bib || '-'}
      </TableCell>
      <TableCell className="py-3">
        <div className="flex flex-col">
          <span className="font-medium">{name || '-'}</span>
          {row.club || row.Club ? (
            <span className="text-xs text-muted-foreground">
              {String(row.club ?? row.Club)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm text-muted-foreground py-3">
        {courseId || '-'}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm text-center py-3">
        {gender || '-'}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground py-3">
        {ag || '-'}
      </TableCell>
      <TableCell className="py-3">
        <StatusBadge status={row.derivedStatus} />
      </TableCell>
      <TableCell className="hidden md:table-cell font-mono text-sm py-3">
        {chipTime || '-'}
      </TableCell>
      <TableCell className="text-right py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onView}
            title={ATHLETES_VN.actionView}
            aria-label={ATHLETES_VN.actionView}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title={ATHLETES_VN.actionEdit}
            aria-label={ATHLETES_VN.actionEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onChangeStatus}
            title={ATHLETES_VN.actionChangeStatus}
            aria-label={ATHLETES_VN.actionChangeStatus}
          >
            <ArrowRightLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onContact}
            title={ATHLETES_VN.actionContact}
            aria-label={ATHLETES_VN.actionContact}
          >
            <Mail className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onAuditLog}
            title={ATHLETES_VN.actionAuditLog}
            aria-label={ATHLETES_VN.actionAuditLog}
          >
            <History className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default AthleteRow;
