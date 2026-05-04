'use client';

/**
 * Scenarios Editor — list + add/edit/delete special case injections.
 *
 * BTC chỉ điền số lượng (count) — engine tự pick athletes deterministic
 * theo hash(simCourseId+bib) → reset + replay luôn ra cùng kết quả.
 *
 * 7 loại scenario built-in:
 * - MISS_FINISH / MISS_MIDDLE_CP / MISS_START — random N
 * - MAT_FAILURE — N athletes liên tiếp tại 1 CP cụ thể
 * - TOP_N_MISS_FINISH — Top N nhanh nhất (force CRITICAL)
 * - LATE_FINISHER — shift Finish +X phút
 * - PHANTOM_RUNNER — drop Start nhưng giữ TM1+
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  simulatorApi,
  SCENARIO_LABELS,
  type Simulation,
  type SimulationScenario,
  type ScenarioType,
  type SimulationCourse,
} from '@/lib/timing-alert-simulator-api';

const TYPE_OPTIONS: ScenarioType[] = [
  'MISS_FINISH',
  'MISS_MIDDLE_CP',
  'MISS_START',
  'MAT_FAILURE',
  'TOP_N_MISS_FINISH',
  'LATE_FINISHER',
  'PHANTOM_RUNNER',
];

export function ScenariosEditor({ sim }: { sim: Simulation }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const toggleEnabled = useMutation({
    mutationFn: (input: { scenarioId: string; enabled: boolean }) =>
      simulatorApi.updateScenario(sim.id, input.scenarioId, {
        enabled: input.enabled,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['simulator-detail', sim.id] }),
  });

  const deleteScenario = useMutation({
    mutationFn: (scenarioId: string) =>
      simulatorApi.deleteScenario(sim.id, scenarioId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['simulator-detail', sim.id] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>🎭 Special case scenarios</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            + Add scenario
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-sm text-stone-700">
            💡 <strong>BTC điền số lượng → engine tự inject vào data live.</strong>{' '}
            Athletes affected chọn deterministic theo hash(simCourseId+BIB) → reset +
            replay luôn ra cùng kết quả. Apply tại serve time → KHÔNG ghi đè
            snapshot DB.
          </CardContent>
        </Card>

        {sim.scenarios.length === 0 ? (
          <div className="rounded border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
            Chưa có scenario. Click "+ Add scenario" để tạo case test.
          </div>
        ) : (
          <div className="space-y-2">
            {sim.scenarios.map((s) => (
              <ScenarioRow
                key={s.id}
                scenario={s}
                courses={sim.courses}
                onToggle={(enabled) =>
                  toggleEnabled.mutate({ scenarioId: s.id, enabled })
                }
                onDelete={() => {
                  if (confirm(`Xóa scenario "${SCENARIO_LABELS[s.type].label}"?`)) {
                    deleteScenario.mutate(s.id);
                  }
                }}
                simId={sim.id}
              />
            ))}
          </div>
        )}
      </CardContent>

      <CreateScenarioDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sim={sim}
      />
    </Card>
  );
}

// ─────────── Row ───────────

function ScenarioRow({
  scenario: s,
  courses,
  onToggle,
  onDelete,
  simId,
}: {
  scenario: SimulationScenario;
  courses: SimulationCourse[];
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  simId: string;
}) {
  const meta = SCENARIO_LABELS[s.type];
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editCount, setEditCount] = useState(String(s.count));
  const [editTopN, setEditTopN] = useState(String(s.topN ?? 10));
  const [editShift, setEditShift] = useState(String(s.shiftMinutes ?? 30));
  const [editCp, setEditCp] = useState(s.checkpointKey ?? '');

  const saveEdit = useMutation({
    mutationFn: () =>
      simulatorApi.updateScenario(simId, s.id, {
        count: Number(editCount) || 0,
        topN: Number(editTopN) || undefined,
        shiftMinutes: Number(editShift) || undefined,
        checkpointKey: editCp || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['simulator-detail', simId] });
      setEditing(false);
    },
  });

  const courseName = s.scopeSimCourseId
    ? courses.find((c) => c.simCourseId === s.scopeSimCourseId)?.label ?? '?'
    : 'mọi course';

  return (
    <div
      className={`rounded border p-3 ${
        s.enabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[300px]">
          <div className="flex items-center gap-2">
            <Switch checked={s.enabled} onCheckedChange={onToggle} />
            <span className="font-semibold">{meta.label}</span>
            <Badge variant="outline" className="font-mono text-xs">
              {s.type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              scope: {courseName}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-stone-600">{meta.description}</p>

          {!editing ? (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {s.type === 'TOP_N_MISS_FINISH' ? (
                <span>
                  Top <strong>{s.topN ?? 10}</strong> athletes
                </span>
              ) : (
                <span>
                  Count: <strong>{s.count}</strong> athletes
                </span>
              )}
              {s.type === 'MAT_FAILURE' && s.checkpointKey && (
                <span>
                  Checkpoint: <strong>{s.checkpointKey}</strong>
                </span>
              )}
              {s.type === 'LATE_FINISHER' && (
                <span>
                  Shift: <strong>+{s.shiftMinutes ?? 30}m</strong>
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {s.type === 'TOP_N_MISS_FINISH' ? (
                <>
                  <label>Top N:</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={editTopN}
                    onChange={(e) => setEditTopN(e.target.value)}
                    className="h-8 w-20"
                  />
                </>
              ) : (
                <>
                  <label>Count:</label>
                  <Input
                    type="number"
                    min="0"
                    value={editCount}
                    onChange={(e) => setEditCount(e.target.value)}
                    className="h-8 w-20"
                  />
                </>
              )}
              {s.type === 'MAT_FAILURE' && (
                <>
                  <label>Checkpoint:</label>
                  <Input
                    value={editCp}
                    onChange={(e) => setEditCp(e.target.value)}
                    placeholder="TM2"
                    className="h-8 w-24"
                  />
                </>
              )}
              {s.type === 'LATE_FINISHER' && (
                <>
                  <label>Shift (phút):</label>
                  <Input
                    type="number"
                    min="1"
                    max="600"
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value)}
                    className="h-8 w-20"
                  />
                </>
              )}
              <Button
                size="sm"
                onClick={() => saveEdit.mutate()}
                disabled={saveEdit.isPending}
              >
                ✓ Lưu
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Hủy
              </Button>
            </div>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              ✏ Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              🗑
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── Create dialog ───────────

function CreateScenarioDialog({
  open,
  onOpenChange,
  sim,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sim: Simulation;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<ScenarioType>('MISS_FINISH');
  const [count, setCount] = useState('5');
  const [topN, setTopN] = useState('10');
  const [shiftMinutes, setShiftMinutes] = useState('30');
  const [checkpointKey, setCheckpointKey] = useState('');
  const [scopeSimCourseId, setScopeSimCourseId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const meta = SCENARIO_LABELS[type];

  const create = useMutation({
    mutationFn: () =>
      simulatorApi.addScenario(sim.id, {
        type,
        enabled: true,
        count: type === 'TOP_N_MISS_FINISH' ? 0 : Number(count) || 0,
        topN: type === 'TOP_N_MISS_FINISH' ? Number(topN) || 10 : undefined,
        shiftMinutes:
          type === 'LATE_FINISHER' ? Number(shiftMinutes) || 30 : undefined,
        checkpointKey:
          type === 'MAT_FAILURE' ? checkpointKey.trim() || undefined : undefined,
        scopeSimCourseId: scopeSimCourseId || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['simulator-detail', sim.id] });
      onOpenChange(false);
      setType('MISS_FINISH');
      setCount('5');
      setTopN('10');
      setShiftMinutes('30');
      setCheckpointKey('');
      setScopeSimCourseId('');
      setDescription('');
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="border-b border-stone-200 pb-3">
          <DialogTitle>Add scenario</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {/* Type select dropdown */}
          <div>
            <label className="text-sm font-semibold">Loại scenario</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ScenarioType)}
              className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {SCENARIO_LABELS[t].label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-stone-600">{meta.description}</p>
          </div>

          {/* Type-specific params */}
          <div className="grid grid-cols-2 gap-3">
            {type === 'TOP_N_MISS_FINISH' ? (
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Top N
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={topN}
                  onChange={(e) => setTopN(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Count (số athletes)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {type === 'MAT_FAILURE' && (
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Checkpoint key
                </label>
                <Input
                  value={checkpointKey}
                  onChange={(e) => setCheckpointKey(e.target.value)}
                  placeholder="TM2"
                  className="mt-1"
                />
              </div>
            )}

            {type === 'LATE_FINISHER' && (
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Shift (phút)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="600"
                  value={shiftMinutes}
                  onChange={(e) => setShiftMinutes(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {/* Scope course full-width when only Count column above */}
            <div
              className={
                type === 'MAT_FAILURE' || type === 'LATE_FINISHER'
                  ? 'col-span-2'
                  : 'col-span-1'
              }
            >
              <label className="text-xs font-semibold uppercase text-stone-500">
                Scope course
              </label>
              <select
                value={scopeSimCourseId}
                onChange={(e) => setScopeSimCourseId(e.target.value)}
                className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-2 text-sm"
              >
                <option value="">Mọi course</option>
                {sim.courses.map((c) => (
                  <option key={c.simCourseId} value={c.simCourseId}>
                    {c.label} ({c.snapshotItems} VĐV)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold uppercase text-stone-500">
              Mô tả (optional)
            </label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Test mat failure tại checkpoint cuối 21K"
              className="mt-1"
            />
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
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Đang tạo...' : 'Tạo scenario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
