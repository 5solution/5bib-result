'use client';

/**
 * Timing Miss Alert — Config page (Manager refactor 03/05/2026)
 *
 * URL: `/races/{raceId}/timing-alerts/config`
 *
 * **Architecture:** chỉ behavior knobs (4 fields). Race-domain config
 * (apiUrl, checkpoints, cutoff, window) sửa ở `/admin/races/[id]/edit`.
 * Timing Alert đọc thẳng race document.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getTimingAlertConfig,
  upsertTimingAlertConfig,
} from '@/lib/timing-alert-api';

export default function TimingAlertConfigPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = String(
    Array.isArray(params?.id) ? params.id[0] : (params?.id ?? ''),
  );
  const qc = useQueryClient();

  const config = useQuery({
    queryKey: ['timing-alert-config', raceId],
    queryFn: () => getTimingAlertConfig(raceId),
    enabled: !!raceId,
  });

  const [pollInterval, setPollInterval] = useState(90);
  const [overdueMinutes, setOverdueMinutes] = useState(30);
  const [topNAlert, setTopNAlert] = useState(3);
  const [enabled, setEnabled] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!config.data) return;
    setPollInterval(config.data.poll_interval_seconds);
    setOverdueMinutes(config.data.overdue_threshold_minutes);
    setTopNAlert(config.data.top_n_alert);
    setEnabled(config.data.enabled);
  }, [config.data]);

  const save = useMutation({
    mutationFn: () =>
      upsertTimingAlertConfig(raceId, {
        poll_interval_seconds: pollInterval,
        overdue_threshold_minutes: overdueMinutes,
        top_n_alert: topNAlert,
        enabled,
      }),
    onSuccess: () => {
      setSaveMsg({ type: 'ok', text: '✅ Đã lưu config' });
      qc.invalidateQueries({ queryKey: ['timing-alert-config', raceId] });
      setTimeout(() => setSaveMsg(null), 4000);
    },
    onError: (err: Error) => {
      setSaveMsg({ type: 'err', text: `❌ ${err.message}` });
    },
  });

  if (config.isLoading) return <Skeleton className="h-64" />;

  const isNew = !config.data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href={`/races/${raceId}/timing-alerts`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Quay lại Alerts dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">⚙ Cấu hình Timing Miss Alert</h1>
        <p className="text-sm text-stone-600">
          {isNew
            ? 'Cấu hình mới cho race này'
            : `Last polled: ${config.data?.last_polled_at ? new Date(config.data.last_polled_at).toLocaleString() : 'chưa poll lần nào'}`}
        </p>
      </div>

      {/* Architecture explainer */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-semibold">📖 Trang này quản lý gì?</p>
          <p className="text-stone-700">
            Chỉ <strong>behavior knobs</strong> cho alert engine (interval poll,
            ngưỡng phát hiện, severity). Toàn bộ <strong>data race</strong> (RR
            API URL, course checkpoints, cutoff time, race start/end) được đọc
            tự động từ race document.
          </p>
          <p className="text-stone-700">
            <strong>Để config RR API + checkpoints:</strong>{' '}
            <Link
              href={`/races/${raceId}/edit`}
              className="text-blue-700 underline hover:text-blue-900"
            >
              vào Race edit page
            </Link>{' '}
            → mỗi course có field <code>apiUrl</code> + array{' '}
            <code>checkpoints</code> (key, distanceKm).
          </p>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? 'Tạo config' : 'Chỉnh sửa config'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Poll interval (giây)
              </label>
              <input
                type="number"
                min={60}
                max={300}
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-stone-500">
                60-300s. Default 90s. Cron tick mỗi 30s, internal lock cho per-
                course rate.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Overdue threshold (phút)
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={overdueMinutes}
                onChange={(e) => setOverdueMinutes(Number(e.target.value))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-stone-500">
                VĐV trễ &gt; ngưỡng này so với projected → flag. Default 30.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Top N → CRITICAL
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={topNAlert}
                onChange={(e) => setTopNAlert(Number(e.target.value))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-stone-500">
                VĐV projected Top N (overall hoặc age group) → severity =
                CRITICAL. Default 3.
              </p>
            </div>
          </div>

          <div className="rounded border border-stone-200 bg-stone-50 p-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5"
              />
              <div>
                <span className="font-semibold">Enable monitoring</span>
                <p className="mt-0.5 text-xs text-stone-600">
                  Khi bật, cron tick mỗi 30s sẽ poll <code>race.courses[].apiUrl</code>{' '}
                  + flag alerts. Tắt giữa giờ race day chỉ trong emergency
                  (BTC sẽ không nhận được CRITICAL push).
                </p>
              </div>
            </label>
          </div>

          {saveMsg && (
            <div
              className={`rounded border p-3 text-sm ${
                saveMsg.type === 'ok'
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {saveMsg.text}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {save.isPending ? 'Saving...' : '💾 Lưu config'}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/races/${raceId}/timing-alerts`)}
            >
              Hủy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
