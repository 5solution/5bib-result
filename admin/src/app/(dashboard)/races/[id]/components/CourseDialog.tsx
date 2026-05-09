'use client';

/**
 * F-006 — Course dialog extracted from races/[id]/page.tsx (Manager
 * Clarification 1). Controlled component: parent owns
 * `courseDialogOpen` / `editingCourse` / `courseForm` state and passes
 * them down. Tabs match the original 4 (Cơ bản, Thông tin, Hình ảnh,
 * Checkpoints) plus the new Map tab.
 *
 * The Map tab body comes from `CourseMapTab.tsx` and is only meaningful
 * when editing an existing course (we need a `courseId` to upload against).
 */
import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, ImageIcon, Info, MapPin, Mountain, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageUpload from '@/components/ImageUpload';
import {
  StepIndicator,
  type Step,
  type StepState,
} from '@/components/wizard/StepIndicator';
import { useCourseMapData } from '@/lib/course-map-hooks';

import { DiscoverPreviewPanel } from './DiscoverPreviewPanel';
import { CourseMapTab } from './CourseMapTab';

export interface CheckpointServices {
  water: boolean;
  food: boolean;
  sleep: boolean;
  dropBag: boolean;
  medical: boolean;
  notes?: string;
}

export interface Checkpoint {
  key: string;
  name: string;
  distance?: string;
  services?: CheckpointServices;
}

export interface Course {
  courseId: string;
  name: string;
  distance?: string;
  distanceKm?: number;
  courseType?: string;
  apiFormat?: string;
  apiUrl?: string;
  imageUrl?: string;
  elevationGain?: number;
  cutOffTime?: string;
  startTime?: string;
  startLocation?: string;
  mapUrl?: string;
  gpxUrl?: string;
  checkpoints?: Checkpoint[];
}

/** Free-shape state used by the inline form. The parent in
 *  `races/[id]/page.tsx` still owns this state as a loose
 *  `Record<string, unknown>`-shaped object so we don't break the existing
 *  call site mid-refactor. Inputs only, no API contract. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CourseFormState = Record<string, any>;

type SetCourseForm = React.Dispatch<React.SetStateAction<CourseFormState>>;

export interface CourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raceId: string;
  /** null when creating a new course, populated when editing. */
  editingCourse: Course | null;
  courseForm: CourseFormState;
  setCourseForm: SetCourseForm;
  onSubmit: () => Promise<void> | void;
  isSubmitting: boolean;
  /** Logto bearer token (legacy — passed straight through to ImageUpload). */
  token: string | null;
}

export function CourseDialog({
  open,
  onOpenChange,
  raceId,
  editingCourse,
  courseForm,
  setCourseForm,
  onSubmit,
  isSubmitting,
  token,
}: CourseDialogProps): React.ReactElement {
  const checkpoints = (courseForm.checkpoints ?? []) as Checkpoint[];

  // F-007 Item #1 — wizard step state derived from form state. Hooks MUST run
  // unconditionally; we pass empty courseId when not editing → useCourseMapData
  // disables itself internally (its own enabled gate).
  const editingCourseId = editingCourse?.courseId ?? '';
  const mapData = useCourseMapData(raceId, editingCourseId);
  const hasGpx = Boolean(mapData.data?.hasGpx);
  const unmatchedCheckpointsCount = React.useMemo(() => {
    const list = mapData.data?.checkpoints ?? [];
    return list.filter(
      (cp) => typeof cp.lat !== 'number' || typeof cp.lng !== 'number',
    ).length;
  }, [mapData.data?.checkpoints]);

  const steps: Step[] = React.useMemo(() => {
    const isSaved = Boolean(editingCourse);
    const hasCps = checkpoints.length > 0;

    const step1State: StepState = isSaved ? 'done' : 'active';
    const step2State: StepState = !isSaved
      ? 'pending'
      : hasCps
        ? 'done'
        : 'active';
    const step3State: StepState = !isSaved
      ? 'pending'
      : !hasCps
        ? 'pending'
        : hasGpx
          ? 'done'
          : 'active';
    const step4State: StepState = !isSaved
      ? 'pending'
      : !hasCps
        ? 'pending'
        : !hasGpx
          ? 'pending'
          : unmatchedCheckpointsCount > 0
            ? 'blocked'
            : 'done';

    return [
      { label: 'Cơ bản', state: step1State },
      { label: 'Discover RR', state: step2State },
      { label: 'Upload GPX', state: step3State },
      {
        label: 'Manual drag',
        state: step4State,
        hint:
          step4State === 'blocked'
            ? `${unmatchedCheckpointsCount} CP chưa khớp`
            : undefined,
      },
    ];
  }, [editingCourse, checkpoints.length, hasGpx, unmatchedCheckpointsCount]);

  const mapTabDisabled = !editingCourse;
  const mapTabTooltip = !editingCourse
    ? 'Lưu cự ly trước'
    : checkpoints.length === 0
      ? 'Discover RR API trước để có checkpoint keys'
      : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Bug fix — Map tab content (banner + map 400px + elevation chart) đẩy
        Hủy/Lưu footer off-screen. Solution: flex column layout with
        - Header: fixed top
        - Body (Tabs): flex-1 + overflow-y-auto → scroll inside dialog
        - Footer: fixed bottom (always visible)
        max-h-[90vh] caps total dialog height for small viewports.
      */}
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        {/* F-009 deprecation banner — additive only (BR-AF-23 byte-for-byte preserve below) */}
        <div className="-mx-6 -mt-6 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
          <span className="flex items-center gap-1.5">
            <Info className="size-3.5" aria-hidden="true" />
            Đã có trang Course Map fullpage mới — modal sẽ retire trong 30 ngày.
          </span>
          {editingCourse ? (
            <Link
              href={`/races/${raceId}/course-map?course=${encodeURIComponent(editingCourse.courseId)}`}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-100"
              onClick={() => onOpenChange(false)}
            >
              Chuyển ngay
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <DialogHeader>
          <DialogTitle>{editingCourse ? 'Sửa cự ly' : 'Thêm cự ly'}</DialogTitle>
          <DialogDescription>
            {editingCourse ? editingCourse.name : 'Nhập thông tin cự ly mới'}
          </DialogDescription>
        </DialogHeader>

        {/* F-007 Item #1 — wizard step indicator above tabs so admin always
            knows where they are in the 4-step setup flow. */}
        <div className="px-1">
          <StepIndicator steps={steps} />
        </div>

        <Tabs defaultValue="basic" className="mt-1 flex flex-1 flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Cơ bản</TabsTrigger>
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="media">Hình ảnh</TabsTrigger>
            <TabsTrigger value="checkpoints">
              Checkpoints
              {checkpoints.length > 0 && (
                <span
                  className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: '#dbeafe', color: '#1d4ed8' }}
                >
                  {checkpoints.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="map"
              disabled={mapTabDisabled}
              title={mapTabTooltip || undefined}
              aria-label={mapTabTooltip ? `Map (${mapTabTooltip})` : 'Map'}
            >
              Map
            </TabsTrigger>
          </TabsList>

          {/* Scroll container — only tabs body scrolls; footer stays sticky */}
          <div className="flex-1 overflow-y-auto pr-1">

          {/* ── Tab 1: Cơ bản ── */}
          <TabsContent value="basic" className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Tên cự ly *</Label>
              <Input
                value={courseForm.name ?? ''}
                onChange={(e) => setCourseForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="42km Full Marathon"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Nhãn khoảng cách</Label>
                <Input
                  value={courseForm.distance ?? ''}
                  onChange={(e) => setCourseForm((p) => ({ ...p, distance: e.target.value }))}
                  placeholder="42km"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Km (số)</Label>
                <Input
                  type="number"
                  value={courseForm.distanceKm ?? ''}
                  onChange={(e) =>
                    setCourseForm((p) => ({
                      ...p,
                      distanceKm: parseFloat(e.target.value) || undefined,
                    }))
                  }
                  placeholder="42.195"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Loại cự ly</Label>
                <Select
                  value={courseForm.courseType ?? 'split'}
                  onValueChange={(val) => setCourseForm((p) => ({ ...p, courseType: val }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split">Split Race</SelectItem>
                    <SelectItem value="lap">Lap Race</SelectItem>
                    <SelectItem value="team_relay">Team Relay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Định dạng API</Label>
                <Select
                  value={courseForm.apiFormat ?? 'json'}
                  onValueChange={(val) => setCourseForm((p) => ({ ...p, apiFormat: val }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>API URL</Label>
              <Input
                value={courseForm.apiUrl ?? ''}
                onChange={(e) => setCourseForm((p) => ({ ...p, apiUrl: e.target.value }))}
                placeholder="https://my.raceresult.com/api/results?contest=708"
              />
            </div>

            {editingCourse && courseForm.apiUrl && (
              <DiscoverPreviewPanel
                raceId={raceId}
                courseId={editingCourse.courseId}
                courseName={editingCourse.name}
                apiUrl={courseForm.apiUrl as string}
                existingCheckpoints={checkpoints}
              />
            )}
          </TabsContent>

          {/* ── Tab 2: Thông tin ── */}
          <TabsContent value="info" className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5">
                  <Mountain className="size-3.5" /> Tổng leo cao (m)
                </Label>
                {/* F-007 Item #10 — GPX consolidation: when GPX uploaded the
                    parsed elevation gain is the source-of-truth (read-only).
                    Fall back to manual input until a GPX exists so legacy
                    races without GPX keep working. */}
                {hasGpx && typeof mapData.data?.gpxParsed?.elevationGain === 'number' ? (
                  <div className="flex flex-col gap-1">
                    <Input
                      type="number"
                      value={mapData.data.gpxParsed.elevationGain}
                      readOnly
                      className="bg-stone-50 text-stone-700"
                    />
                    <span className="text-[11px] text-stone-500">
                      Từ GPX đã upload — quản lý ở tab Map
                    </span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={courseForm.elevationGain ?? ''}
                    onChange={(e) =>
                      setCourseForm((p) => ({
                        ...p,
                        elevationGain: parseInt(e.target.value, 10) || undefined,
                      }))
                    }
                    placeholder="1500"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Thời gian xuất phát
                </Label>
                <Input
                  type="datetime-local"
                  value={courseForm.startTime ?? ''}
                  onChange={(e) => setCourseForm((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> Địa điểm xuất phát
                </Label>
                <Input
                  value={courseForm.startLocation ?? ''}
                  onChange={(e) => setCourseForm((p) => ({ ...p, startLocation: e.target.value }))}
                  placeholder="Quảng trường Lâm Viên"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Cut-off time (COT)
                </Label>
                <Input
                  type="datetime-local"
                  value={courseForm.cutOffTime ?? ''}
                  onChange={(e) => setCourseForm((p) => ({ ...p, cutOffTime: e.target.value }))}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 3: Hình ảnh ── */}
          <TabsContent value="media" className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="size-3.5" /> Ảnh cự ly
              </Label>
              <ImageUpload
                value={courseForm.imageUrl as string | undefined}
                onChange={(url) => setCourseForm((p) => ({ ...p, imageUrl: url }))}
                folder={`races/${raceId}/courses`}
                token={token || undefined}
                label="Tải ảnh cự ly"
                previewHeight="h-28"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Bản đồ cự ly</Label>
              <ImageUpload
                value={courseForm.mapUrl as string | undefined}
                onChange={(url) => setCourseForm((p) => ({ ...p, mapUrl: url }))}
                folder={`races/${raceId}/maps`}
                token={token || undefined}
                label="Tải bản đồ"
                previewHeight="h-28"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>File GPX (URL)</Label>
              {/* F-007 Item #10 — when admin upload GPX qua tab Map, gpxUrl là
                  read-only display (source-of-truth ở tab Map). Trường hợp
                  legacy race chưa upload GPX vẫn giữ free-form input. */}
              {hasGpx ? (
                <div className="flex flex-col gap-1">
                  <Input
                    value={
                      (courseForm.gpxUrl as string | undefined) ??
                      mapData.data?.gpxSimplifiedUrl ??
                      ''
                    }
                    readOnly
                    className="bg-stone-50 font-mono text-xs text-stone-700"
                  />
                  <span className="text-[11px] text-stone-500">
                    Từ file GPX đã upload — quản lý ở tab Map
                  </span>
                </div>
              ) : (
                <Input
                  value={(courseForm.gpxUrl as string | undefined) ?? ''}
                  onChange={(e) => setCourseForm((p) => ({ ...p, gpxUrl: e.target.value }))}
                  placeholder="URL file GPX (nếu nhập tay — ngược lại dùng tab Map)"
                />
              )}
            </div>
          </TabsContent>

          {/* ── Tab 4: Checkpoints ── */}
          <TabsContent value="checkpoints" className="mt-4">
            <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
              {checkpoints.map((cp, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      <Input
                        value={cp.key}
                        onChange={(e) => {
                          const updated = [...checkpoints];
                          updated[idx] = { ...updated[idx], key: e.target.value };
                          setCourseForm((p) => ({ ...p, checkpoints: updated }));
                        }}
                        placeholder="Key (TM1)"
                        className="text-sm"
                      />
                      <Input
                        value={cp.name}
                        onChange={(e) => {
                          const updated = [...checkpoints];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setCourseForm((p) => ({ ...p, checkpoints: updated }));
                        }}
                        placeholder="Tên CP"
                        className="text-sm"
                      />
                      <Input
                        value={cp.distance ?? ''}
                        onChange={(e) => {
                          const updated = [...checkpoints];
                          updated[idx] = {
                            ...updated[idx],
                            distance: e.target.value || undefined,
                          };
                          setCourseForm((p) => ({ ...p, checkpoints: updated }));
                        }}
                        placeholder="Km"
                        className="text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        const updated = checkpoints.filter((_, i) => i !== idx);
                        setCourseForm((p) => ({ ...p, checkpoints: updated }));
                      }}
                      title="Xóa checkpoint"
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Dịch vụ:
                    </span>
                    {(
                      [
                        { key: 'water', label: '💧 Nước' },
                        { key: 'food', label: '🍌 Đồ ăn' },
                        { key: 'sleep', label: '🛏 Ngủ nghỉ' },
                        { key: 'dropBag', label: '🎒 Drop Bag' },
                        { key: 'medical', label: '🏥 Y tế' },
                      ] as { key: keyof CheckpointServices; label: string }[]
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const updated = [...checkpoints];
                          const svc = updated[idx].services || {
                            water: false,
                            food: false,
                            sleep: false,
                            dropBag: false,
                            medical: false,
                          };
                          updated[idx] = {
                            ...updated[idx],
                            services: { ...svc, [key]: !svc[key] },
                          };
                          setCourseForm((p) => ({ ...p, checkpoints: updated }));
                        }}
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          cp.services?.[key]
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {(cp.services?.water ||
                    cp.services?.food ||
                    cp.services?.sleep ||
                    cp.services?.dropBag ||
                    cp.services?.medical) && (
                    <Input
                      value={cp.services?.notes ?? ''}
                      onChange={(e) => {
                        const updated = [...checkpoints];
                        const svc = updated[idx].services || {
                          water: false,
                          food: false,
                          sleep: false,
                          dropBag: false,
                          medical: false,
                        };
                        updated[idx] = {
                          ...updated[idx],
                          services: { ...svc, notes: e.target.value || undefined },
                        };
                        setCourseForm((p) => ({ ...p, checkpoints: updated }));
                      }}
                      placeholder="Ghi chú dịch vụ (VD: Nước + gel + chuối)"
                      className="text-xs"
                    />
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated: Checkpoint[] = [
                    ...checkpoints,
                    { key: '', name: '', distance: '' },
                  ];
                  setCourseForm((p) => ({ ...p, checkpoints: updated }));
                }}
              >
                <Plus className="mr-1 size-4" /> Thêm checkpoint
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab 5: Map (F-006) ── */}
          <TabsContent value="map" className="mt-4">
            <CourseMapTab raceId={raceId} courseId={editingCourse?.courseId ?? null} />
          </TabsContent>

          </div>{/* end scroll container */}
        </Tabs>

        <DialogFooter className="mt-4 border-t border-stone-200 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={() => void onSubmit()} disabled={isSubmitting || !courseForm.name}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu cự ly'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
