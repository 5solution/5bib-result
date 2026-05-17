'use client';

/**
 * Phase B FEATURE-001 — Discover preview inline trên race edit form.
 *
 * BR-04: Auto-trigger discover khi BTC paste/edit course.apiUrl (debounce 800ms).
 * BR-05 (F-039 fix): "Apply" button gọi applyCheckpoints endpoint TRỰC TIẾP để
 *        persist vào course.checkpoints — KHÔNG còn rely vào parent form save
 *        (which silently dropped edits). BTC review tên + distance → click Apply
 *        → backend write → query invalidate → UI refresh.
 * BR-09: Re-discover preserve tên BTC đã đặt (existing checkpoints merge).
 *
 * F-039 thay đổi (Option A — distance honesty):
 *  - Distance intermediate luôn null từ backend (Start=0, Finish=courseTotal stay).
 *  - BTC nhập thủ công nếu cần distance per CP (hoặc bỏ trống).
 *  - "🔄 Reset to vendor order" button — force re-apply current vendor order,
 *    preserve names BTC đã đặt, clear distance về backend suggestion (= migrate
 *    legacy data saved theo time-ratio guess cũ).
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  applyCheckpoints,
  discoverCheckpoints,
  type CheckpointApplyItem,
  type DetectedCheckpoint,
} from '@/lib/timing-alert-api';

interface ExistingCheckpoint {
  key: string;
  name?: string;
  distance?: string;
  distanceKm?: number;
}

interface Props {
  raceId: string;
  courseId: string;
  courseName: string;
  apiUrl: string;
  existingCheckpoints: ExistingCheckpoint[];
}

interface EditableRow extends DetectedCheckpoint {
  editName: string;
  editDistanceKm: string;
}

export function DiscoverPreviewPanel({
  raceId,
  courseId,
  courseName,
  apiUrl,
  existingCheckpoints,
}: Props) {
  const qc = useQueryClient();
  const [debouncedApiUrl, setDebouncedApiUrl] = useState(apiUrl);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Debounce 800ms apiUrl change
  useEffect(() => {
    const t = setTimeout(() => setDebouncedApiUrl(apiUrl), 800);
    return () => clearTimeout(t);
  }, [apiUrl]);

  const discover = useMutation({
    mutationFn: () => {
      if (!debouncedApiUrl?.trim()) {
        throw new Error('apiUrl trống');
      }
      return discoverCheckpoints(raceId, courseId);
    },
    onSuccess: (data) => {
      // BR-09: MERGE preserve names — nếu existing checkpoint có name BTC đặt,
      // giữ nguyên. Distance: BTC preserve nếu đã có > 0.
      const existingByKey = new Map<string, ExistingCheckpoint>();
      for (const ck of existingCheckpoints) {
        existingByKey.set(ck.key, ck);
      }
      setRows(
        data.detectedCheckpoints.map((cp) => {
          const existing = existingByKey.get(cp.key);
          return {
            ...cp,
            editName: existing?.name ?? cp.suggestedName,
            editDistanceKm:
              existing?.distanceKm !== undefined
                ? String(existing.distanceKm)
                : cp.suggestedDistanceKm !== null
                  ? String(cp.suggestedDistanceKm)
                  : '',
          };
        }),
      );
      setErrMsg(null);
    },
    onError: (err: Error) => setErrMsg(err.message),
  });

  // F-039 — Apply mutation persists rows to backend via applyCheckpoints endpoint.
  // 2 modes:
  //  - mode='current': save rows as-edited (BTC current edits)
  //  - mode='vendor-reset': save với editDistanceKm = backend suggestion (= reset
  //    legacy time-ratio guess về null cho intermediate, giữ Start=0 + Finish=total).
  //    Preserve editName BTC đã đặt.
  const apply = useMutation({
    mutationFn: async (mode: 'current' | 'vendor-reset') => {
      if (rows.length === 0) throw new Error('Không có checkpoints để save');
      const payload: CheckpointApplyItem[] = rows.map((r) => {
        const name = (r.editName.trim() || r.suggestedName || r.key).trim();
        let distanceKm: number | null;
        if (mode === 'vendor-reset') {
          // Reset distance về backend suggestion (intermediate = null)
          distanceKm = r.suggestedDistanceKm;
        } else {
          // Use BTC current edit
          const raw = r.editDistanceKm.trim();
          if (raw.length === 0) {
            distanceKm = null;
          } else {
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) {
              throw new Error(`distanceKm không hợp lệ ở row "${r.key}": ${raw}`);
            }
            distanceKm = n;
          }
        }
        return { key: r.key, name, distanceKm };
      });
      return applyCheckpoints(raceId, courseId, payload);
    },
    onSuccess: (result, mode) => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      qc.invalidateQueries({ queryKey: ['timing-alert-discover', raceId] });
      qc.invalidateQueries({ queryKey: ['race', raceId] });
      toast.success(
        mode === 'vendor-reset'
          ? `🔄 Đã reset ${result.saved} checkpoints về vendor order (giữ tên BTC)`
          : `💾 Đã lưu ${result.saved} checkpoints cho ${courseName}`,
      );
      if (mode === 'vendor-reset') {
        // Re-sync rows từ backend sau reset (suggestedDistanceKm = null cho intermediate)
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            editDistanceKm:
              r.suggestedDistanceKm !== null ? String(r.suggestedDistanceKm) : '',
          })),
        );
      }
      setErrMsg(null);
    },
    onError: (err: Error) => {
      setErrMsg(err.message);
      toast.error(`❌ Save thất bại: ${err.message}`);
    },
  });

  // Auto-trigger khi debouncedApiUrl thay đổi (nếu không empty)
  useEffect(() => {
    if (debouncedApiUrl?.trim() && courseId) {
      discover.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedApiUrl, courseId]);

  if (!apiUrl?.trim()) return null;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-blue-900">
            🔍 Auto-derive checkpoints — {courseName}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            className="h-7 text-xs"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </Button>
        </div>

        {!collapsed && (
          <>
            {discover.isPending && <Skeleton className="h-32 w-full" />}

            {errMsg && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                ❌ {errMsg}
              </div>
            )}

            {!discover.isPending && rows.length > 0 && (
              <>
                <div className="overflow-x-auto rounded border border-stone-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-100">
                      <tr>
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">Loại</th>
                        <th className="px-2 py-1.5 text-left">Key</th>
                        <th className="px-2 py-1.5 text-left">Tên hiển thị</th>
                        <th className="px-2 py-1.5 text-left">Distance (km)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr
                          key={r.key}
                          className={`border-t border-stone-200 ${
                            r.isImplicitStart
                              ? 'bg-green-50'
                              : r.isImplicitFinish
                                ? 'bg-amber-50'
                                : ''
                          }`}
                        >
                          <td className="px-2 py-1 text-stone-500">{idx + 1}</td>
                          <td className="px-2 py-1">
                            {r.isImplicitStart && <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">🚩 Start</Badge>}
                            {r.isImplicitFinish && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">🏁 Finish</Badge>}
                            {!r.isImplicitStart && !r.isImplicitFinish && '—'}
                          </td>
                          <td className="px-2 py-1 font-mono">{r.key}</td>
                          <td className="px-2 py-1">
                            <Input
                              value={r.editName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRows((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, editName: v } : p)),
                                );
                              }}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={r.editDistanceKm}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRows((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, editDistanceKm: v } : p)),
                                );
                              }}
                              className="h-7 w-24 text-xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 text-xs text-stone-700">
                  <p>
                    💡 <strong>Order</strong>: theo thứ tự vendor RaceResult JSON (chronological course design).
                  </p>
                  <p>
                    📏 <strong>Distance per CP KHÔNG có trong vendor API</strong> — chỉ Start=0 và Finish=tổng cự ly là chắc chắn.
                    Intermediate (TM1..TM5) BTC <em>tự nhập nếu biết course design</em> hoặc bỏ trống.
                    Distance KHÔNG ảnh hưởng tới progression bar — chỉ là display label.
                  </p>
                  <p>
                    💾 <strong>Lưu cách nào</strong>: click <em>"💾 Lưu checkpoints"</em> để persist edits hiện tại,
                    hoặc <em>"🔄 Reset về vendor order"</em> để fix race cũ (clear distance guess cũ về null, giữ tên BTC đã đặt).
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => apply.mutate('vendor-reset')}
                    disabled={apply.isPending}
                    className="h-8 text-xs"
                    title="Force re-apply current vendor order, preserve names BTC đã đặt, clear distance guess cũ về null cho intermediate CP"
                  >
                    🔄 Reset về vendor order
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => apply.mutate('current')}
                    disabled={apply.isPending}
                    className="h-8 text-xs"
                  >
                    {apply.isPending ? 'Đang lưu...' : '💾 Lưu checkpoints'}
                  </Button>
                </div>
              </>
            )}

            {!discover.isPending && rows.length === 0 && !errMsg && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Chưa có data — vendor có thể chưa ingest BIBs hoặc apiUrl sai. Re-discover
                sau khi RR setup xong.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
