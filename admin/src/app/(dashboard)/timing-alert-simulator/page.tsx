'use client';

/**
 * Timing Alert Simulator — danh sách simulation + tạo mới.
 *
 * URL: `/timing-alert-simulator`
 *
 * Workflow:
 * 1. Click "Tạo simulation" → form 4 RR URLs (5K/10K/21K/42K) + speed factor
 * 2. Sau khi tạo → BE fetch snapshots → mở detail page điều khiển
 * 3. Detail page = play/pause/seek + show publicUrl per course
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { simulatorApi, type SimulationStatus } from '@/lib/timing-alert-simulator-api';

const STATUS_COLORS: Record<SimulationStatus, string> = {
  created: 'bg-stone-200 text-stone-700',
  running: 'bg-green-100 text-green-800 border-green-300',
  paused: 'bg-amber-100 text-amber-800 border-amber-300',
  completed: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function SimulatorListPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const sims = useQuery({
    queryKey: ['simulator-list'],
    queryFn: () => simulatorApi.list(),
    enabled: isAuthenticated,
  });

  if (authLoading) return <Skeleton className="h-64 w-full" />;
  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-6">Vui lòng đăng nhập.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🎬 Timing Alert Simulator</h1>
          <p className="text-sm text-stone-600">
            Replay RaceResult API thật để test timing-alert nhiều lần.
            Snapshot fetch 1 lần, replay theo simulation clock.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Tạo simulation</Button>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-semibold">📖 Cách dùng nhanh:</p>
          <ol className="ml-5 list-decimal space-y-1 text-stone-700">
            <li>Tạo simulation, paste 4 URL RR (5K/10K/21K/42K)</li>
            <li>Sau khi snapshot fetch xong, copy <code>publicUrl</code> mỗi course</li>
            <li>Vào <code>/admin/races/[id]/edit</code>, paste URL vào <code>course.apiUrl</code></li>
            <li>Quay lại đây, click <strong>Play</strong> — simulation clock chạy</li>
            <li>Vào timing-alerts dashboard race đó → cocktail dashboard live như race thật</li>
          </ol>
        </CardContent>
      </Card>

      {sims.isLoading ? (
        <Skeleton className="h-64" />
      ) : sims.data?.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-stone-600">
            Chưa có simulation nào. Click "+ Tạo simulation" để bắt đầu.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sims.data?.map((sim) => (
            <Link key={sim.id} href={`/timing-alert-simulator/${sim.id}`}>
              <Card className="cursor-pointer transition-all hover:border-blue-400 hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{sim.name}</span>
                    <Badge className={STATUS_COLORS[sim.status]}>
                      {sim.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {sim.description && (
                    <p className="text-xs text-stone-600">{sim.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {sim.courses.map((c) => (
                      <Badge key={c.simCourseId} variant="outline">
                        {c.label} · {c.snapshotItems} VĐV
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>
                      Speed {sim.speedFactor}x · T={formatSeconds(sim.currentSimSeconds)}
                    </span>
                    <span>{new Date(sim.updatedAt).toLocaleString('vi-VN')}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateSimulationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ['simulator-list'] })}
      />
    </div>
  );
}

// ─────────── Create dialog ───────────

interface CourseInput {
  label: string;
  sourceUrl: string;
}

function CreateSimulationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [speedFactor, setSpeedFactor] = useState('1.0');
  const [startOffset, setStartOffset] = useState('0');
  const [courses, setCourses] = useState<CourseInput[]>([
    { label: '5K', sourceUrl: '' },
    { label: '10K', sourceUrl: '' },
    { label: '21K', sourceUrl: '' },
    { label: '42K', sourceUrl: '' },
  ]);
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Cần nhập name');
      const valid = courses.filter(
        (c) => c.label.trim() && c.sourceUrl.trim().startsWith('http'),
      );
      if (valid.length === 0) throw new Error('Cần ít nhất 1 course với URL hợp lệ');
      return simulatorApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        speedFactor: Number(speedFactor) || 1.0,
        startOffsetSeconds: Number(startOffset) || 0,
        courses: valid,
      });
    },
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      // reset form
      setName('');
      setDescription('');
      setSpeedFactor('1.0');
      setStartOffset('0');
      setCourses([
        { label: '5K', sourceUrl: '' },
        { label: '10K', sourceUrl: '' },
        { label: '21K', sourceUrl: '' },
        { label: '42K', sourceUrl: '' },
      ]);
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo simulation mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold">Tên</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hành trình vì an ninh tổ quốc — replay 1"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Mô tả</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold">Speed factor</label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={speedFactor}
                onChange={(e) => setSpeedFactor(e.target.value)}
              />
              <p className="mt-0.5 text-xs text-stone-500">
                1.0 = realtime · 5.0 = 5x speed (4h race trong 48 phút)
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold">Start offset (giây)</label>
              <Input
                type="number"
                min="0"
                value={startOffset}
                onChange={(e) => setStartOffset(e.target.value)}
              />
              <p className="mt-0.5 text-xs text-stone-500">
                Skip ngay tới T=N giây race (VD 7200 = giờ thứ 2)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Courses (RR URLs)</label>
            {courses.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  className="w-20"
                  value={c.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCourses((p) =>
                      p.map((x, i) => (i === idx ? { ...x, label: v } : x)),
                    );
                  }}
                  placeholder="5K"
                />
                <Input
                  className="flex-1"
                  value={c.sourceUrl}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCourses((p) =>
                      p.map((x, i) => (i === idx ? { ...x, sourceUrl: v } : x)),
                    );
                  }}
                  placeholder="https://api.raceresult.com/396207/..."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCourses((p) => p.filter((_, i) => i !== idx))
                  }
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCourses((p) => [...p, { label: '', sourceUrl: '' }])
              }
            >
              + Thêm course
            </Button>
          </div>

          {err && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              ❌ {err}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Hủy
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {create.isPending ? 'Đang fetch RR...' : '🎬 Tạo + fetch snapshots'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
