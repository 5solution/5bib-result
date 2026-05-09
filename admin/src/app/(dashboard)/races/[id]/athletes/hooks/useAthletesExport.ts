'use client';

/**
 * F-014 BR-AS-50/51 — CSV export of currently-filtered athletes.
 *
 * Reuses the same CSV header order as the legacy settings/page.tsx
 * `handleExportCSV` (line 593): `Rank, BIB, Name, Gender, Category,
 * ChipTime, GunTime, Pace, Gap, Nationality` plus BOM `﻿` prefix
 * for Excel UTF-8 compatibility.
 *
 * F-014 adds 3 columns: `Status` (derived 9-status), `Course`, `Paid`.
 * Header preserved verbatim for downstream tools that depend on it.
 */

import { toast } from 'sonner';
import { ATHLETES_VN } from '../athletes.microcopy';
import type { AthleteWithStatus } from '../athletes.types';

export function useAthletesExport() {
  function exportRows(rows: AthleteWithStatus[], filenameBase = 'athletes') {
    if (!rows.length) {
      toast.error(ATHLETES_VN.toastExportError);
      return;
    }
    const headers = [
      'Rank',
      'BIB',
      'Name',
      'Gender',
      'Category',
      'ChipTime',
      'GunTime',
      'Pace',
      'Gap',
      'Nationality',
      // F-014 new columns appended (preserve legacy header order for compat)
      'Status',
      'Course',
      'Paid',
    ];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      // CSV-quote when contains comma/quote/newline.
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      csvRows.push(
        [
          escape(r.OverallRank ?? r.overallRank ?? ''),
          escape(r.Bib ?? r.bib ?? ''),
          escape(r.Name ?? r.name ?? ''),
          escape(r.Gender ?? r.gender ?? ''),
          escape(r.Category ?? r.category ?? ''),
          escape(r.ChipTime ?? r.chipTime ?? ''),
          escape(r.GunTime ?? r.gunTime ?? ''),
          escape(r.Pace ?? r.pace ?? ''),
          escape((r as { Gap?: string }).Gap ?? ''),
          escape(r.Nationality ?? r.nationality ?? ''),
          escape(r.derivedStatus),
          escape(r.courseId ?? r.course_id ?? ''),
          escape(r.paid === true ? 'yes' : r.paid === false ? 'no' : ''),
        ].join(','),
      );
    }
    const blob = new Blob(['﻿' + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(ATHLETES_VN.toastExportSuccess(rows.length));
  }

  return { exportRows };
}
