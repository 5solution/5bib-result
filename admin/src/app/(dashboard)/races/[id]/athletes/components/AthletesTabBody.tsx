'use client';

/**
 * F-014 — Main Athletes tab orchestrator.
 *
 * Composition:
 *   AthletesFilterBar
 *   AthletesTable (with selection + pagination)
 *   BulkActionBar (sticky-bottom)
 *   AthleteEditDrawer (right-side sheet)
 *   ChangeStatusDialog
 *
 * Pulls together all hooks (`useAthleteFilters`, `useAthletesSearch`,
 * `useAthletesList`, `useAthletesBulkActions`, `useAthletesExport`).
 *
 * Status-aware guard (F-011): when `raceStatus === 'draft'` we show the
 * empty `draft-guard` state in lieu of the table. Filter bar and search
 * are still mounted so admin can pre-author filter URLs.
 */

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { adminControllerEditResult } from '@/lib/api-generated';
import { AthletesFilterBar } from './AthletesFilterBar';
import { AthletesTable } from './AthletesTable';
import { BulkActionBar } from './BulkActionBar';
import { AthleteEditDrawer } from './AthleteEditDrawer';
import { AthletesEmptyState } from './AthletesEmptyState';
import { ChangeStatusDialog } from './ChangeStatusDialog';
import { useAthleteFilters } from '../hooks/useAthleteFilters';
import { useAthletesSearch } from '../hooks/useAthletesSearch';
import { useAthletesList } from '../hooks/useAthletesList';
import { useAthletesBulkActions } from '../hooks/useAthletesBulkActions';
import { useAthletesExport } from '../hooks/useAthletesExport';
import { ATHLETES_VN } from '../athletes.microcopy';
import type {
  AthleteWithStatus,
  DrawerMode,
} from '../athletes.types';
import type { AthleteStatus } from '../athletes.constant';

interface CourseLite {
  courseId: string;
  name: string;
}

interface AthletesTabBodyProps {
  raceId: string;
  raceStatus: string;
  raceTitle: string;
  courses: CourseLite[];
}

export function AthletesTabBody(props: AthletesTabBodyProps) {
  const { raceId, raceStatus, raceTitle, courses } = props;
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // ─── Filter / search / list hooks ────────────────────────────
  const filterCtx = useAthleteFilters();
  const search = useAthletesSearch(filterCtx.filters.q);

  // Mirror live input to URL (debounced) — keeps bookmark-able state.
  useEffect(() => {
    if (search.debouncedQuery !== filterCtx.filters.q) {
      filterCtx.setFilter('q', search.debouncedQuery);
    }
    // intentionally only on debouncedQuery change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.debouncedQuery]);

  const list = useAthletesList({
    raceId,
    filters: filterCtx.filters,
    view: filterCtx.view,
    page: filterCtx.page,
    raceStatus,
    debouncedQuery: search.debouncedQuery,
  });

  const bulk = useAthletesBulkActions();
  const exporter = useAthletesExport();

  // Available age-groups (derived from rows for filter dropdown)
  const ageGroupOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of list.rows) {
      const ag = String(r.category ?? r.Category ?? '');
      if (ag) set.add(ag);
    }
    return Array.from(set).sort();
  }, [list.rows]);

  // ─── Drawer + dialog state ────────────────────────────────────
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('closed');
  const [drawerRow, setDrawerRow] = useState<AthleteWithStatus | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogRow, setStatusDialogRow] =
    useState<AthleteWithStatus | null>(null);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['athletes', raceId] });
  };

  const openEdit = (row: AthleteWithStatus) => {
    setDrawerRow(row);
    setDrawerMode('edit');
  };
  const openView = (row: AthleteWithStatus) => {
    setDrawerRow(row);
    setDrawerMode('profile');
  };
  const openChangeStatus = (row: AthleteWithStatus) => {
    setStatusDialogRow(row);
    setStatusDialogOpen(true);
  };
  const openContact = (row: AthleteWithStatus) => {
    // F-014.5 will integrate Mailchimp / SMS gateway. For now toast
    // a stub message so admin knows the affordance exists.
    toast.info(`Liên hệ VĐV BIB ${row.bib ?? row.Bib ?? ''} sẽ có ở F-014.5`);
  };
  const openAuditLog = (row: AthleteWithStatus) => {
    setDrawerRow(row);
    setDrawerMode('profile');
  };

  // ─── Status change handler — single row via existing PATCH endpoint ────
  const handleConfirmStatus = async (next: AthleteStatus, reason: string) => {
    if (!token || !statusDialogRow?._id) {
      toast.error(ATHLETES_VN.toastStatusError);
      return;
    }
    try {
      const { error } = await adminControllerEditResult({
        path: { resultId: statusDialogRow._id },
        body: {
          status: next,
          reason,
        } as unknown as Parameters<typeof adminControllerEditResult>[0]['body'],
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success(ATHLETES_VN.toastStatusSuccess);
      setStatusDialogOpen(false);
      handleSaved();
    } catch {
      toast.error(ATHLETES_VN.toastStatusError);
    }
  };

  // ─── Render branches ──────────────────────────────────────────
  if (raceStatus === 'draft') {
    return (
      <div className="flex flex-col gap-4">
        <AthletesEmptyState variant="draft-guard" raceId={raceId} />
      </div>
    );
  }

  const showZeroData =
    !list.isLoading && !list.error && list.total === 0 && filterCtx.filters.q === '' &&
    filterCtx.filters.statuses.length === 0 &&
    filterCtx.filters.courseIds.length === 0;
  const showZeroMatch =
    !list.isLoading && !list.error && list.rows.length === 0 && !showZeroData;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight">
          {ATHLETES_VN.pageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {raceTitle ? `${raceTitle} · ` : ''}
          {ATHLETES_VN.pageSubtitle}
        </p>
      </header>

      <AthletesFilterBar
        filters={filterCtx.filters}
        view={filterCtx.view}
        query={search.query}
        onQueryChange={search.setQuery}
        onSetFilter={filterCtx.setFilter}
        onSetView={filterCtx.setView}
        onReset={() => {
          search.setQuery('');
          filterCtx.reset();
          bulk.clear();
        }}
        courseOptions={courses}
        ageGroupOptions={ageGroupOptions}
      />

      {showZeroData ? (
        <AthletesEmptyState variant="zero-data" raceId={raceId} />
      ) : showZeroMatch ? (
        <AthletesEmptyState
          variant="zero-match"
          raceId={raceId}
          onResetFilters={() => {
            search.setQuery('');
            filterCtx.reset();
          }}
        />
      ) : (
        <AthletesTable
          rows={list.rows}
          total={list.total}
          page={filterCtx.page}
          isLoading={list.isLoading}
          selected={bulk.selected}
          onToggleSelect={bulk.toggle}
          onToggleSelectAll={bulk.toggleAll}
          onSetPage={filterCtx.setPage}
          onView={openView}
          onEdit={openEdit}
          onChangeStatus={openChangeStatus}
          onContact={openContact}
          onAuditLog={openAuditLog}
        />
      )}

      <BulkActionBar
        selectedCount={bulk.selected.size}
        capExceeded={bulk.capExceeded}
        defer={bulk.defer}
        onChangeStatus={() => toast.info(ATHLETES_VN.toastBulkDeferred)}
        onExportCsv={() => {
          const sel = list.rows.filter((r) => {
            const id =
              r._id ?? `${r.raceId ?? ''}-${r.bib ?? r.Bib ?? ''}`;
            return bulk.selected.has(id);
          });
          exporter.exportRows(sel, `${raceTitle || 'race'}-selected`);
        }}
        onClear={bulk.clear}
      />

      <AthleteEditDrawer
        open={drawerMode !== 'closed'}
        mode={drawerMode === 'closed' ? 'edit' : drawerMode}
        row={drawerRow}
        onOpenChange={(open) => {
          if (!open) setDrawerMode('closed');
        }}
        onSaved={handleSaved}
      />

      {statusDialogRow && (
        <ChangeStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          currentStatus={statusDialogRow.derivedStatus}
          bibLabel={String(statusDialogRow.bib ?? statusDialogRow.Bib ?? '')}
          onConfirm={handleConfirmStatus}
        />
      )}
    </div>
  );
}

export default AthletesTabBody;
