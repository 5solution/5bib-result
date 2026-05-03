'use client';

/**
 * Timing Miss Alert — Config page
 *
 * URL: `/races/{raceId}/timing-alerts/config`
 *
 * Phase 2 minimal config UI:
 * - Display current config (masked API keys)
 * - Inline edit RaceResult event ID + API keys per course
 * - Course checkpoints JSON editor (Phase 2 raw textarea, Phase 3 visual builder)
 * - Cutoff times + poll interval + thresholds
 * - Enable/disable toggle
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  getTimingAlertConfig,
  upsertTimingAlertConfig,
  type CourseCheckpoint,
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

  const [rrEventId, setRrEventId] = useState('');
  const [apiKeysJson, setApiKeysJson] = useState('');
  const [checkpointsJson, setCheckpointsJson] = useState('');
  const [cutoffJson, setCutoffJson] = useState('');
  const [pollInterval, setPollInterval] = useState(90);
  const [overdueMinutes, setOverdueMinutes] = useState(30);
  const [topNAlert, setTopNAlert] = useState(3);
  const [enabled, setEnabled] = useState(false);
  const [eventStartIso, setEventStartIso] = useState('');
  const [eventEndIso, setEventEndIso] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Hydrate form khi load existing config
  useEffect(() => {
    if (!config.data) return;
    setRrEventId(config.data.rr_event_id);
    setApiKeysJson(JSON.stringify(config.data.rr_api_keys_masked, null, 2));
    setCheckpointsJson(
      JSON.stringify(config.data.course_checkpoints, null, 2),
    );
    setCutoffJson(JSON.stringify(config.data.cutoff_times ?? {}, null, 2));
    setPollInterval(config.data.poll_interval_seconds);
    setOverdueMinutes(config.data.overdue_threshold_minutes);
    setTopNAlert(config.data.top_n_alert);
    setEnabled(config.data.enabled);
  }, [config.data]);

  const save = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      setSaveOk(false);

      let apiKeys: Record<string, string>;
      let checkpoints: Record<string, CourseCheckpoint[]>;
      let cutoffs: Record<string, string>;

      try {
        apiKeys = JSON.parse(apiKeysJson);
      } catch (e) {
        throw new Error(`API keys JSON sai format: ${(e as Error).message}`);
      }
      try {
        checkpoints = JSON.parse(checkpointsJson);
      } catch (e) {
        throw new Error(
          `Course checkpoints JSON sai format: ${(e as Error).message}`,
        );
      }
      try {
        cutoffs = cutoffJson.trim() ? JSON.parse(cutoffJson) : {};
      } catch (e) {
        throw new Error(`Cutoff JSON sai format: ${(e as Error).message}`);
      }

      // Validation: API keys không phải plaintext re-input nếu là masked
      // (LE2K...7VWA format) → admin phải nhập keys mới hoàn toàn nếu muốn
      // edit. Server sẽ encrypt tất cả values sau.
      const hasMaskedValues = Object.values(apiKeys).some((v) =>
        v.includes('...') && v.includes('chars)'),
      );
      if (hasMaskedValues) {
        throw new Error(
          'API keys hiện đang masked preview — phải re-input plaintext keys mới (32-char) cho mọi course muốn edit',
        );
      }

      return upsertTimingAlertConfig(raceId, {
        rr_event_id: rrEventId.trim(),
        rr_api_keys: apiKeys,
        course_checkpoints: checkpoints,
        cutoff_times: cutoffs,
        event_start_iso: eventStartIso || undefined,
        event_end_iso: eventEndIso || undefined,
        poll_interval_seconds: pollInterval,
        overdue_threshold_minutes: overdueMinutes,
        top_n_alert: topNAlert,
        enabled,
      });
    },
    onSuccess: () => {
      setSaveOk(true);
      qc.invalidateQueries({ queryKey: ['timing-alert-config', raceId] });
    },
    onError: (err: Error) => {
      setSaveError(err.message);
    },
  });

  if (config.isLoading) return <Skeleton className="h-64" />;

  const isNew = !config.data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/races/${raceId}/timing-alerts`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Quay lại Alerts dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">
            ⚙ Cấu hình Timing Miss Alert
          </h1>
          <p className="text-sm text-stone-600">
            {isNew
              ? 'Tạo cấu hình mới cho race này'
              : `Race ID: ${config.data?.race_id} · Last polled: ${config.data?.last_polled_at ? new Date(config.data.last_polled_at).toLocaleString() : 'never'}`}
          </p>
        </div>
      </div>

      {/* Help block */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 space-y-2 text-sm">
          <p className="font-semibold">📖 Hướng dẫn nhanh</p>
          <ol className="ml-4 list-decimal space-y-1 text-stone-700">
            <li>
              <strong>RR Event ID:</strong> ID event trên RaceResult (VD
              "396207"). BTC cấp.
            </li>
            <li>
              <strong>API keys per course:</strong> Mỗi course (5KM/21KM/42KM)
              có 1 API key 32-char riêng. Server tự encrypt AES-256-GCM.
            </li>
            <li>
              <strong>Course checkpoints:</strong> Mỗi course list checkpoints
              theo thứ tự, mỗi cái có <code>key</code> (match RR Chiptimes
              JSON) + <code>distance_km</code>. <strong>BẮT BUỘC</strong> có
              key "Finish" cuối cùng.
            </li>
            <li>
              <strong>Cutoff times:</strong> Optional — VĐV slow vượt cutoff
              KHÔNG flag (gate-closed, không phải miss thật).
            </li>
            <li>
              <strong>Enable monitoring</strong>: bật khi đã sẵn sàng race day.
              Cron tick mỗi 30s sẽ poll RR API.
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? 'Tạo config' : 'Chỉnh sửa config'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold">RaceResult Event ID</label>
            <input
              type="text"
              value={rrEventId}
              onChange={(e) => setRrEventId(e.target.value)}
              placeholder="396207"
              className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">
              RR API keys (JSON: course → key)
            </label>
            <textarea
              value={apiKeysJson}
              onChange={(e) => setApiKeysJson(e.target.value)}
              rows={6}
              placeholder='{ "42KM": "NFSJ1OMPKSSU35EWUD8XR8NJQBOFAS1Q" }'
              className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-xs"
            />
            <p className="text-xs text-stone-500">
              Khi load config existing, keys hiển thị masked preview. Phải nhập
              lại plaintext mới nếu muốn rotate.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">
              Course checkpoints (JSON: course → array)
            </label>
            <textarea
              value={checkpointsJson}
              onChange={(e) => setCheckpointsJson(e.target.value)}
              rows={10}
              placeholder='{"42KM": [{"key":"Start","distance_km":0},{"key":"TM1","distance_km":10},{"key":"Finish","distance_km":42.195}]}'
              className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-xs"
            />
            <p className="text-xs text-stone-500">
              <strong>BẮT BUỘC</strong> có entry "Finish" cuối + distance_km
              strictly increasing.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">
              Cutoff times (optional, JSON: course → "HH:MM:SS")
            </label>
            <textarea
              value={cutoffJson}
              onChange={(e) => setCutoffJson(e.target.value)}
              rows={3}
              placeholder='{ "42KM": "08:00:00" }'
              className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Event start (optional)
              </label>
              <input
                type="datetime-local"
                value={eventStartIso}
                onChange={(e) => setEventStartIso(e.target.value)}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Event end (optional)
              </label>
              <input
                type="datetime-local"
                value={eventEndIso}
                onChange={(e) => setEventEndIso(e.target.value)}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Poll interval (giây, 60-300)
              </label>
              <input
                type="number"
                min={60}
                max={300}
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
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
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Top N alert CRITICAL
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={topNAlert}
                onChange={(e) => setTopNAlert(Number(e.target.value))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded border border-stone-200 bg-stone-50 p-3">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="enabled" className="text-sm">
              <strong>Enable monitoring</strong> — cron tick mỗi 30s sẽ poll
              RR API + flag alerts
            </label>
          </div>

          {saveError && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              ❌ {saveError}
            </div>
          )}
          {saveOk && (
            <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              ✅ Đã lưu config thành công
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
