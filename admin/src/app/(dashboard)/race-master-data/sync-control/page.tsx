/**
 * FEATURE-048 Phase 3 — Bulk Sync Control admin page (BR-48-09).
 *
 * Staged backfill: 10 → 50 → 195 races. State machine enforced backend-side.
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type BulkSyncStage =
  | 'idle'
  | 'staged_10_running'
  | 'staged_10_done'
  | 'staged_50_running'
  | 'staged_50_done'
  | 'full_running'
  | 'full_done'
  | 'failed';

interface OverallStatus {
  stage: BulkSyncStage;
  raceCoverage: {
    synced: number;
    total: number;
    percent: number;
  };
}

interface BulkSyncProgress {
  runId: string;
  mode: 'staged_10' | 'staged_50' | 'full';
  status: 'running' | 'done' | 'failed';
  progress: {
    current: number;
    total: number;
    percent: number;
  };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy: string;
  reason?: string;
  errors: string[];
  racesSucceeded: number;
  racesFailed: number;
}

interface TriggerResponse {
  runId: string;
  mode: string;
  racesQueued: number;
  estimatedDuration: string;
}

const fetchOverall = async (): Promise<OverallStatus> => {
  const res = await fetch('/api/admin/race-master-data/sync-overall-status', {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fetchProgress = async (runId: string): Promise<BulkSyncProgress | null> => {
  const res = await fetch(
    `/api/admin/race-master-data/sync-status/${encodeURIComponent(runId)}`,
    { credentials: 'include' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const triggerSync = async (data: {
  mode: 'staged_10' | 'staged_50' | 'full';
  reason?: string;
}): Promise<TriggerResponse> => {
  const res = await fetch('/api/admin/race-master-data/full-sync-all', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
};

export default function SyncControlPage() {
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [fullReason, setFullReason] = useState('');
  const [showFullDialog, setShowFullDialog] = useState(false);

  const overall = useQuery({
    queryKey: ['sync-overall'],
    queryFn: fetchOverall,
    refetchInterval: 10000, // refresh every 10s
  });

  const progress = useQuery({
    queryKey: ['sync-progress', activeRunId],
    queryFn: () => fetchProgress(activeRunId ?? ''),
    enabled: !!activeRunId,
    refetchInterval: (q) =>
      q.state.data?.status === 'running' ? 3000 : false, // poll 3s while running
  });

  const triggerMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      queryClient.invalidateQueries({ queryKey: ['sync-overall'] });
      setShowFullDialog(false);
      setFullReason('');
    },
    onError: (err: Error) => {
      alert(`Sync failed: ${err.message}`);
    },
  });

  const isRunning =
    overall.data?.stage === 'staged_10_running' ||
    overall.data?.stage === 'staged_50_running' ||
    overall.data?.stage === 'full_running';

  const canStaged50 =
    overall.data?.stage === 'staged_10_done' ||
    overall.data?.stage === 'staged_50_done' ||
    overall.data?.stage === 'full_done';

  const canFull =
    overall.data?.stage === 'staged_50_done' || overall.data?.stage === 'full_done';

  // Clear activeRunId when progress reaches done state
  useEffect(() => {
    if (progress.data?.status === 'done' || progress.data?.status === 'failed') {
      queryClient.invalidateQueries({ queryKey: ['sync-overall'] });
    }
  }, [progress.data?.status, queryClient]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          Bulk Race Master Data Sync (F-048)
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Staged backfill 10 → 50 → 195 races. State machine enforced — không skip stages.
        </p>
      </header>

      {/* Overall stats */}
      {overall.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-stone-100" />
      ) : overall.data ? (
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-3xl font-bold text-stone-900">
              {overall.data.raceCoverage.synced.toLocaleString('vi-VN')}
              <span className="text-lg text-stone-500">
                {' '}
                / {overall.data.raceCoverage.total.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="mt-1 text-sm text-stone-600">Races synced</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${overall.data.raceCoverage.percent}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-3xl font-bold text-stone-900">
              {overall.data.raceCoverage.percent}%
            </div>
            <div className="mt-1 text-sm text-stone-600">Coverage</div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-2xl font-bold text-stone-900">
              <StageBadge stage={overall.data.stage} />
            </div>
            <div className="mt-1 text-sm text-stone-600">Current stage</div>
          </div>
        </section>
      ) : null}

      {/* Buttons */}
      <section className="mb-6 space-y-3">
        <SyncButton
          label="🔬 Sync 10 races (Pilot)"
          description="Verify sync setup với 10 races mới nhất. ETA 3-5 phút."
          color="primary"
          disabled={isRunning}
          onClick={() => {
            if (confirm('Trigger Pilot sync 10 races? ETA 3-5 phút.')) {
              triggerMutation.mutate({ mode: 'staged_10' });
            }
          }}
          loading={triggerMutation.isPending && triggerMutation.variables?.mode === 'staged_10'}
        />
        <SyncButton
          label="📊 Sync 50 races (Verify)"
          description="Mở rộng sau khi pilot OK. ETA 10-15 phút."
          color="outline-blue"
          disabled={!canStaged50 || isRunning}
          onClick={() => {
            if (confirm('Trigger sync 50 races? ETA 10-15 phút.')) {
              triggerMutation.mutate({ mode: 'staged_50' });
            }
          }}
          loading={triggerMutation.isPending && triggerMutation.variables?.mode === 'staged_50'}
        />
        <SyncButton
          label="🚀 Sync 195 races (Full)"
          description="Full production backfill. ETA 30-60 phút. CẦN lý do ≥10 ký tự."
          color="outline-red"
          disabled={!canFull || isRunning}
          onClick={() => setShowFullDialog(true)}
          loading={triggerMutation.isPending && triggerMutation.variables?.mode === 'full'}
        />
      </section>

      {/* Live progress */}
      {progress.data && (
        <section className="mb-6 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
          <h3 className="mb-3 font-semibold text-blue-900">
            🔄 Live sync progress (Run {progress.data.runId.substring(0, 8)}...)
          </h3>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {progress.data.mode} — {progress.data.status}
            </span>
            <span className="text-stone-600">
              {progress.data.progress.current} / {progress.data.progress.total} races
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress.data.progress.percent}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-stone-600">Succeeded: </span>
              <span className="font-medium text-green-700">
                {progress.data.racesSucceeded}
              </span>
            </div>
            <div>
              <span className="text-stone-600">Failed: </span>
              <span className="font-medium text-red-700">
                {progress.data.racesFailed}
              </span>
            </div>
            <div>
              <span className="text-stone-600">Duration: </span>
              <span className="font-medium">
                {progress.data.durationMs
                  ? `${(progress.data.durationMs / 1000).toFixed(0)}s`
                  : `${((Date.now() - new Date(progress.data.startedAt).getTime()) / 1000).toFixed(0)}s elapsed`}
              </span>
            </div>
          </div>
          {progress.data.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-red-700">
                {progress.data.errors.length} errors (click expand)
              </summary>
              <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-white p-2 text-xs text-red-700">
                {progress.data.errors.join('\n')}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* Full mode dialog */}
      {showFullDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-stone-900">
              🚀 Full Sync 195 races
            </h3>
            <p className="mb-4 text-sm text-stone-700">
              ETA 30-60 phút. Lý do bắt buộc ≥10 ký tự (audit log).
            </p>
            <textarea
              value={fullReason}
              onChange={(e) => setFullReason(e.target.value)}
              placeholder="vd: PROD backfill 195 races sau khi pilot stages PASS — 2026-05-20"
              rows={4}
              className="mb-4 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              maxLength={1000}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowFullDialog(false);
                  setFullReason('');
                }}
                className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (fullReason.length < 10) {
                    alert('Lý do tối thiểu 10 ký tự');
                    return;
                  }
                  triggerMutation.mutate({ mode: 'full', reason: fullReason });
                }}
                disabled={triggerMutation.isPending || fullReason.length < 10}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {triggerMutation.isPending ? 'Đang trigger...' : 'Xác nhận Full Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageBadge({ stage }: { stage: BulkSyncStage }) {
  const config = {
    idle: { label: 'Idle', color: 'text-stone-600' },
    staged_10_running: { label: 'Pilot...', color: 'text-blue-600' },
    staged_10_done: { label: '✓ Pilot', color: 'text-green-700' },
    staged_50_running: { label: 'Verify...', color: 'text-blue-600' },
    staged_50_done: { label: '✓ Verify', color: 'text-green-700' },
    full_running: { label: 'Full sync...', color: 'text-blue-600' },
    full_done: { label: '✓ Full done', color: 'text-green-700' },
    failed: { label: '✗ Failed', color: 'text-red-700' },
  }[stage];
  return <span className={config.color}>{config.label}</span>;
}

function SyncButton({
  label,
  description,
  color,
  disabled,
  onClick,
  loading,
}: {
  label: string;
  description: string;
  color: 'primary' | 'outline-blue' | 'outline-red';
  disabled?: boolean;
  onClick?: () => void;
  loading?: boolean;
}) {
  const colorClass = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    'outline-blue': 'border-blue-300 text-blue-700 bg-white hover:bg-blue-50',
    'outline-red': 'border-red-300 text-red-700 bg-white hover:bg-red-50',
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full rounded-lg border-2 px-4 py-3 text-left ${colorClass} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <div className="font-semibold">{loading ? '⏳ ' + label : label}</div>
      <div className="mt-1 text-sm opacity-80">{description}</div>
    </button>
  );
}
