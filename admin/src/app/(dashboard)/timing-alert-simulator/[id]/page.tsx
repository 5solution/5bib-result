'use client';

/**
 * Simulator detail page — control panel + per-course publicUrl.
 *
 * URL: `/timing-alert-simulator/[id]`
 *
 * Features:
 * - Status badge + current sim time (auto-tick every 1s khi running)
 * - Play / Pause / Reset / Seek buttons
 * - Per-course list: snapshot meta + publicUrl (copy button)
 * - Speed factor + offset edit inline
 * - Refresh snapshot button per course
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  simulatorApi,
  type SimulationStatus,
} from '@/lib/timing-alert-simulator-api';
import { ScenariosEditor } from './components/ScenariosEditor';

const STATUS_COLORS: Record<SimulationStatus, string> = {
  created: 'bg-stone-200 text-stone-700',
  running: 'bg-green-100 text-green-800 border-green-300',
  paused: 'bg-amber-100 text-amber-800 border-amber-300',
  completed: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function SimulatorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(Array.isArray(params?.id) ? params.id[0] : (params?.id ?? ''));
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [seekValue, setSeekValue] = useState('0');
  const [editSpeed, setEditSpeed] = useState<string | null>(null);
  const [editOffset, setEditOffset] = useState<string | null>(null);

  const sim = useQuery({
    queryKey: ['simulator-detail', id],
    queryFn: () => simulatorApi.get(id),
    enabled: isAuthenticated && !!id,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 2000 : 5000),
  });

  // Local clock tick để hiển thị currentSimSeconds tăng mỗi giây giữa
  // các refetch (giảm flash).
  const [localTick, setLocalTick] = useState(0);
  useEffect(() => {
    if (sim.data?.status !== 'running') return;
    const handle = setInterval(() => setLocalTick((t) => t + 1), 1000);
    return () => clearInterval(handle);
  }, [sim.data?.status]);

  const play = useMutation({
    mutationFn: () => simulatorApi.play(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulator-detail', id] }),
  });
  const pause = useMutation({
    mutationFn: () => simulatorApi.pause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulator-detail', id] }),
  });
  const reset = useMutation({
    mutationFn: () => simulatorApi.reset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulator-detail', id] }),
  });
  const seek = useMutation({
    mutationFn: (seconds: number) => simulatorApi.seek(id, seconds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulator-detail', id] }),
  });
  const updateMeta = useMutation({
    mutationFn: (patch: Parameters<typeof simulatorApi.update>[1]) =>
      simulatorApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['simulator-detail', id] });
      setEditSpeed(null);
      setEditOffset(null);
    },
  });
  const deleteSim = useMutation({
    mutationFn: () => simulatorApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['simulator-list'] });
      router.push('/timing-alert-simulator');
    },
  });
  const refreshSnap = useMutation({
    mutationFn: (simCourseId: string) =>
      simulatorApi.refreshSnapshot(id, simCourseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulator-detail', id] }),
  });

  if (authLoading) return <Skeleton className="h-64 w-full" />;
  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-6">Vui lòng đăng nhập.</CardContent>
      </Card>
    );
  }
  if (sim.isLoading) return <Skeleton className="h-96 w-full" />;
  if (sim.isError || !sim.data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-800">
          ❌ {(sim.error as Error)?.message ?? 'Simulation không tồn tại'}
        </CardContent>
      </Card>
    );
  }

  const data = sim.data;
  // Compute display sim seconds — base + localTick × speedFactor khi running
  const displaySimSeconds =
    data.status === 'running'
      ? data.currentSimSeconds + localTick * data.speedFactor
      : data.currentSimSeconds;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/timing-alert-simulator"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Danh sách simulations
        </Link>
        <h1 className="mt-2 text-2xl font-bold">🎬 {data.name}</h1>
        {data.description && (
          <p className="text-sm text-stone-600">{data.description}</p>
        )}
      </div>

      {/* Control panel */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={STATUS_COLORS[data.status]}>
              {data.status.toUpperCase()}
            </Badge>
            <div className="font-mono text-2xl">
              T = {formatSeconds(displaySimSeconds)}
            </div>
            <div className="text-sm text-stone-500">
              speed {data.speedFactor}x · offset {data.startOffsetSeconds}s
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {data.status !== 'running' ? (
              <Button
                onClick={() => play.mutate()}
                disabled={play.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                ▶ Play
              </Button>
            ) : (
              <Button
                onClick={() => pause.mutate()}
                disabled={pause.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                ⏸ Pause
              </Button>
            )}
            <Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
              ⏮ Reset
            </Button>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={seekValue}
                onChange={(e) => setSeekValue(e.target.value)}
                className="w-32"
                placeholder="Giây"
              />
              <Button
                variant="outline"
                onClick={() => seek.mutate(Number(seekValue) || 0)}
                disabled={seek.isPending}
              >
                ⏩ Seek
              </Button>
            </div>
            <Button
              variant="outline"
              className="ml-auto border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              🗑 Xóa
            </Button>
          </div>

          {/* Inline meta editors */}
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="w-32 font-semibold">Speed factor:</span>
              {editSpeed === null ? (
                <>
                  <span>{data.speedFactor}x</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditSpeed(String(data.speedFactor))}
                  >
                    ✏
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editSpeed}
                    onChange={(e) => setEditSpeed(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      updateMeta.mutate({ speedFactor: Number(editSpeed) })
                    }
                  >
                    ✓
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditSpeed(null)}
                  >
                    ×
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 font-semibold">Start offset:</span>
              {editOffset === null ? (
                <>
                  <span>{data.startOffsetSeconds}s</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditOffset(String(data.startOffsetSeconds))
                    }
                  >
                    ✏
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min="0"
                    value={editOffset}
                    onChange={(e) => setEditOffset(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      updateMeta.mutate({
                        startOffsetSeconds: Number(editOffset),
                      })
                    }
                  >
                    ✓
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOffset(null)}
                  >
                    ×
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special case scenarios editor */}
      <ScenariosEditor sim={data} />

      {/* Per-course publicUrl + meta */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">📋 Courses & public URLs</h2>
        <div className="space-y-3">
          {data.courses.map((c) => (
            <Card key={c.simCourseId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>
                    {c.label} · {c.snapshotItems.toLocaleString('vi-VN')} VĐV
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshSnap.mutate(c.simCourseId)}
                      disabled={refreshSnap.isPending}
                    >
                      🔄 Refresh snapshot
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-sm">
                <div>
                  <div className="text-xs uppercase text-stone-500">
                    Public URL (paste vào course.apiUrl)
                  </div>
                  <CopyField value={c.publicUrl} />
                </div>
                <div>
                  <div className="text-xs uppercase text-stone-500">
                    Source RR URL
                  </div>
                  <CopyField value={c.sourceUrl} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-stone-600">
                  <span>
                    Earliest:{' '}
                    {c.earliestSeconds !== null
                      ? formatSeconds(c.earliestSeconds)
                      : '—'}
                  </span>
                  <span>
                    Latest:{' '}
                    {c.latestSeconds !== null
                      ? formatSeconds(c.latestSeconds)
                      : '—'}
                  </span>
                  <span>
                    Fetched:{' '}
                    {c.snapshotFetchedAt
                      ? new Date(c.snapshotFetchedAt).toLocaleString('vi-VN')
                      : 'chưa fetch'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              Tất cả snapshot data + publicUrls sẽ bị xóa. Race nào đang
              dùng publicUrl này sẽ nhận `[]` empty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSim.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={value}
        className="font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — manual copy */
          }
        }}
      >
        {copied ? '✓ Copied' : '📋 Copy'}
      </Button>
    </div>
  );
}

function formatSeconds(s: number): string {
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(Math.floor(s));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sec = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
