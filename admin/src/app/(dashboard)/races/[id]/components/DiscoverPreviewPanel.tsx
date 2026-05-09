'use client';

/**
 * Phase B FEATURE-001 — Discover preview inline trên race edit form.
 *
 * BR-04: Auto-trigger discover khi BTC paste/edit course.apiUrl (debounce 800ms).
 * BR-05: PREVIEW only — KHÔNG silent persist. BTC review tên + distance, click
 *        Apply để write vào courseForm.checkpoints (parent state). Save form
 *        sau đó persist.
 * BR-09: Re-discover preserve tên BTC đã đặt (existing checkpoints merge).
 *
 * Component dùng existing endpoint POST /discover-checkpoints/:courseId
 * (KHÔNG dùng cache endpoint — frontend-driven, debounce đủ tránh spam).
 */

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  discoverCheckpoints,
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
                <p className="text-xs text-stone-600">
                  💡 BTC review + edit tên/distance trên đây. Khi save form race, checkpoints
                  sẽ commit vào course.checkpoints. Re-paste apiUrl khác → re-discover, tên cũ
                  preserve nếu key giống nhau.
                </p>
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
