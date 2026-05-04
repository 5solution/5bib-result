'use client';

/**
 * Phase 2.1 — Auto-derive checkpoints UI dialog.
 *
 * User pain point (Danny 03/05/2026): "bắt team tao đi cấu hình 2 lần có
 * mà điên". Dialog này gọi `discover-checkpoints` → preview keys + distance
 * suggested → BTC override name/distanceKm → confirm save.
 *
 * Workflow:
 * 1. Open dialog (pass courseId from Course card)
 * 2. Auto-trigger `discover` query — show suggestions table
 * 3. BTC edit names + distances inline
 * 4. Click "Lưu checkpoints" → `apply` → close + invalidate snapshot
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  applyCheckpoints,
  discoverCheckpoints,
  type CheckpointApplyItem,
  type DetectedCheckpoint,
} from '@/lib/timing-alert-api';

interface Props {
  raceId: string;
  courseId: string | null;
  courseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditableRow extends DetectedCheckpoint {
  editName: string;
  editDistanceKm: string; // string để cho phép input "" và parse khi submit
}

export function CheckpointDiscoveryDialog({
  raceId,
  courseId,
  courseName,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const discovery = useQuery({
    queryKey: ['timing-alert-discover', raceId, courseId],
    queryFn: () => {
      if (!courseId) throw new Error('Missing courseId');
      return discoverCheckpoints(raceId, courseId);
    },
    enabled: open && !!courseId && !!raceId,
    // Discover gọi RR API external, kết quả thay đổi mỗi poll → no cache
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Sync discovery → editable rows khi data về
  useEffect(() => {
    if (discovery.data) {
      setRows(
        discovery.data.detectedCheckpoints.map((cp) => ({
          ...cp,
          editName: cp.suggestedName,
          editDistanceKm:
            cp.suggestedDistanceKm !== null ? String(cp.suggestedDistanceKm) : '',
        })),
      );
      setErrMsg(null);
    }
  }, [discovery.data]);

  const apply = useMutation({
    mutationFn: () => {
      if (!courseId) throw new Error('Missing courseId');
      const payload: CheckpointApplyItem[] = rows.map((r) => ({
        key: r.key,
        name: r.editName.trim() || r.key,
        distanceKm:
          r.editDistanceKm.trim().length > 0
            ? Number(r.editDistanceKm)
            : null,
      }));
      // Validate: nếu distance nhập được nhưng không phải số → reject
      const bad = payload.find(
        (p) =>
          p.distanceKm !== null &&
          (typeof p.distanceKm !== 'number' || isNaN(p.distanceKm) || p.distanceKm < 0),
      );
      if (bad) {
        throw new Error(`distanceKm không hợp lệ ở row "${bad.key}"`);
      }
      return applyCheckpoints(raceId, courseId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      qc.invalidateQueries({ queryKey: ['timing-alert-discover', raceId] });
      onOpenChange(false);
    },
    onError: (err: Error) => setErrMsg(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>🪄 Auto-derive checkpoints — {courseName}</DialogTitle>
          <DialogDescription>
            Hệ thống suy ra timing point từ kết quả RaceResult. Anh review
            tên + khoảng cách, sửa nếu cần, rồi nhấn lưu.
          </DialogDescription>
        </DialogHeader>

        {discovery.isLoading && <Skeleton className="h-48 w-full" />}

        {discovery.isError && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            ❌ {(discovery.error as Error)?.message ?? 'Discover thất bại'}
          </div>
        )}

        {discovery.data && (
          <div className="space-y-4">
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatBox
                label="Athletes API"
                value={discovery.data.totalAthletes.toString()}
              />
              <StatBox
                label="Đã chạy"
                value={discovery.data.athletesWithAnyTime.toString()}
              />
              <StatBox
                label="Đã finish"
                value={discovery.data.finishersCount.toString()}
              />
            </div>

            {/* Notes */}
            {discovery.data.notes.length > 0 && (
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-stone-700">
                {discovery.data.notes.map((n, i) => (
                  <p key={i} className="mb-1 last:mb-0">
                    💡 {n}
                  </p>
                ))}
              </div>
            )}

            {/* Editable table */}
            {rows.length === 0 ? (
              <div className="rounded border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
                Chưa phát hiện checkpoint nào. Race có thể vừa start — đợi
                vài phút rồi mở lại dialog này.
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-stone-200">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-12" />
                    <col className="w-24" />
                    <col className="w-[260px]" />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col className="w-28" />
                  </colgroup>
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Key (RR)</th>
                      <th className="px-3 py-2 text-left">Tên hiển thị</th>
                      <th className="px-3 py-2 text-left">Distance (km)</th>
                      <th className="px-3 py-2 text-left">Coverage</th>
                      <th className="px-3 py-2 text-left">Median time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.key} className="border-t border-stone-200">
                        <td className="px-3 py-2 text-stone-500">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.key}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={r.editName}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRows((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, editName: v } : p,
                                ),
                              );
                            }}
                            className="h-8 w-full text-sm"
                            placeholder="VD: Trạm 1 - Suối Vàng"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={r.editDistanceKm}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRows((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, editDistanceKm: v } : p,
                                ),
                              );
                            }}
                            className="h-8 w-full text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={
                              r.coverage >= 0.95
                                ? 'border-green-300 bg-green-50 text-green-800'
                                : r.coverage >= 0.85
                                  ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
                                  : 'border-stone-300 bg-stone-50 text-stone-700'
                            }
                          >
                            {Math.round(r.coverage * 100)}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">
                          {formatSeconds(r.medianTimeSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {errMsg && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            ❌ {errMsg}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={apply.isPending}
          >
            Hủy
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || rows.length === 0}
          >
            {apply.isPending ? 'Đang lưu...' : '💾 Lưu checkpoints'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-xl font-bold text-stone-900">{value}</div>
    </div>
  );
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
