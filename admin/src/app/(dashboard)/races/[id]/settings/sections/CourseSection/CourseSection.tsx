'use client';

/**
 * F-014 BR-AS-49 — Course section.
 *
 * Verbatim port of legacy `Courses` tab (page.tsx 1138–1281). Hosts:
 *   - F-009 link card (CourseMapFullpageLinkCard) — re-imported as-is.
 *   - "Thêm cự ly" button (header + footer; legacy duplicate consolidated)
 *   - CourseTable + CourseDialog (the dialog itself is the existing
 *     `../components/CourseDialog` — preserved untouched per BR-AF-23).
 *   - 7 row actions (CSV / ForceSync / ResetData / Clone / Edit / Delete +
 *     loading state via syncingCourseId/resettingCourseId).
 */

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import {
  adminControllerForceSync,
  raceResultControllerGetRaceResults,
  racesControllerAddCourse,
  racesControllerRemoveCourse,
  racesControllerUpdateCourse,
} from '@/lib/api-generated';
import { fetchCourseDataStats } from '@/lib/course-data-ops-api';
import {
  ClearApiUrlConfirmDialog,
  ResetDataConfirmDialog,
  type RaceLiveStatus,
} from '@/components/course-data-ops';
import { CourseDialog } from '../../../components/CourseDialog';
import { CourseMapFullpageLinkCard } from '../../../course-map/components/CourseMapFullpageLinkCard';
import { CourseTable } from './CourseTable';
import type { Course, Race } from '../section-shared.types';

// F-068 BR-68-18 post-reset poll snapshot config (Danny chốt A)
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS_NON_COMBO = 5;
const POLL_MAX_ATTEMPTS_COMBO = 60; // ~2 min — poll "forever" up to a sane cap

interface CourseSectionProps {
  raceId: string;
  race: Race;
  onRefetch: () => void;
}

export function CourseSection({ raceId, race, onRefetch }: CourseSectionProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
  const [resettingCourseId, setResettingCourseId] = useState<string | null>(null);

  // F-068 — reset/clear-apiUrl dialog state
  const [resetDialog, setResetDialog] = useState<
    | {
        open: true;
        courseId: string;
        courseName: string;
      }
    | { open: false }
  >({ open: false });
  const [clearApiUrlDialog, setClearApiUrlDialog] = useState<
    | { open: true; courseId: string; courseName: string }
    | { open: false }
  >({ open: false });

  // F-068 BR-68-18 per-course post-reset poll progress
  const [pollProgressByCourse, setPollProgressByCourse] = useState<
    Record<string, { attempt: number; total: number } | undefined>
  >({});
  const pollAbortRef = useRef<Map<string, AbortController>>(new Map());

  const raceLiveStatus: RaceLiveStatus = (race?.status ?? undefined) as RaceLiveStatus;

  /**
   * F-068 BR-68-18 — Post-reset poll snapshot.
   * `combo=true` (apiUrl already cleared) → poll forever (Danny chốt A)
   * `combo=false` (apiUrl still set) → poll 5x × 2s then stop
   */
  const startPostResetPoll = useCallback(
    async (courseId: string, combo: boolean) => {
      // Cancel any in-flight poll for this course
      const existing = pollAbortRef.current.get(courseId);
      if (existing) existing.abort();
      const controller = new AbortController();
      pollAbortRef.current.set(courseId, controller);

      const total = combo
        ? POLL_MAX_ATTEMPTS_COMBO
        : POLL_MAX_ATTEMPTS_NON_COMBO;
      for (let attempt = 1; attempt <= total; attempt++) {
        if (controller.signal.aborted) return;
        setPollProgressByCourse((prev) => ({
          ...prev,
          [courseId]: { attempt, total },
        }));
        // Invalidate immediately so the row badge re-fetches
        await queryClient.invalidateQueries({
          queryKey: ['course-data-stats', raceId, courseId],
        });
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (controller.signal.aborted) return;
        try {
          const stats = await fetchCourseDataStats(raceId, courseId);
          if (stats.rowCount === 0) {
            setPollProgressByCourse((prev) => ({
              ...prev,
              [courseId]: undefined,
            }));
            return;
          }
        } catch {
          // Network blip — keep polling
        }
      }
      // Exhausted attempts without seeing rowCount=0 — clear progress badge so
      // user sees the latest cached count (may be stale if backend still busy).
      setPollProgressByCourse((prev) => ({
        ...prev,
        [courseId]: undefined,
      }));
    },
    [queryClient, raceId],
  );

  const [courseForm, setCourseForm] = useState<Record<string, unknown>>({
    courseId: '',
    name: '',
    distance: '',
    courseType: 'split',
    apiFormat: 'json',
    apiUrl: '',
    checkpoints: [],
  });

  function resetForm() {
    setCourseForm({
      courseId: '',
      name: '',
      distance: '',
      courseType: 'split',
      apiFormat: 'json',
      apiUrl: '',
      checkpoints: [],
      imageUrl: '',
      elevationGain: undefined,
      cutOffTime: '',
      startTime: '',
      startLocation: '',
      mapUrl: '',
      gpxUrl: '',
    });
  }

  function openAdd() {
    setEditingCourse(null);
    resetForm();
    setCourseDialogOpen(true);
  }

  function openEdit(course: Course) {
    setEditingCourse(course);
    setCourseForm({
      courseId: course.courseId,
      name: course.name,
      distance: course.distance,
      distanceKm: course.distanceKm,
      courseType: course.courseType || 'split',
      apiFormat: course.apiFormat || 'json',
      apiUrl: course.apiUrl,
      imageUrl: course.imageUrl,
      elevationGain: course.elevationGain,
      cutOffTime: course.cutOffTime,
      startTime: course.startTime,
      startLocation: course.startLocation,
      mapUrl: course.mapUrl,
      gpxUrl: course.gpxUrl,
      checkpoints: course.checkpoints || [],
    });
    setCourseDialogOpen(true);
  }

  function openClone(course: Course) {
    setEditingCourse(null);
    setCourseForm({
      courseId: '',
      name: course.name + ' (Copy)',
      distance: course.distance,
      distanceKm: course.distanceKm,
      courseType: course.courseType || 'split',
      apiFormat: course.apiFormat || 'json',
      apiUrl: course.apiUrl || '',
      imageUrl: course.imageUrl || '',
      elevationGain: course.elevationGain,
      cutOffTime: course.cutOffTime || '',
      startTime: course.startTime || '',
      startLocation: course.startLocation || '',
      mapUrl: course.mapUrl || '',
      gpxUrl: course.gpxUrl || '',
      checkpoints: course.checkpoints
        ? JSON.parse(JSON.stringify(course.checkpoints))
        : [],
    });
    setCourseDialogOpen(true);
  }

  async function handleSaveCourse() {
    if (!token || !courseForm.name) return;
    setSavingCourse(true);
    try {
      const cf = courseForm as Record<string, unknown>;
      const checkpoints = Array.isArray(cf.checkpoints) && cf.checkpoints.length
        ? cf.checkpoints
        : undefined;
      const body = {
        name: cf.name,
        distance: cf.distance,
        distanceKm: cf.distanceKm,
        courseType: cf.courseType,
        apiFormat: cf.apiFormat,
        apiUrl: cf.apiUrl,
        imageUrl: cf.imageUrl,
        elevationGain: cf.elevationGain,
        cutOffTime: cf.cutOffTime,
        startTime: cf.startTime,
        startLocation: cf.startLocation,
        mapUrl: cf.mapUrl,
        gpxUrl: cf.gpxUrl,
        checkpoints,
      } as unknown as Parameters<typeof racesControllerAddCourse>[0]['body'];

      if (editingCourse) {
        const { error } = await racesControllerUpdateCourse({
          path: { id: raceId, courseId: editingCourse.courseId },
          body,
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success('Cập nhật cự ly thành công!');
      } else {
        const { error } = await racesControllerAddCourse({
          path: { id: raceId },
          body,
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success('Thêm cự ly thành công!');
        if (cf.apiUrl) {
          const cid = String(
            cf.courseId ||
              String(cf.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          );
          toast.info('Đang đồng bộ dữ liệu...');
          try {
            await adminControllerForceSync({
              path: { raceId, courseId: cid },
              ...authHeaders(token),
            });
            toast.success('Đồng bộ dữ liệu thành công!');
          } catch {
            toast.warning('Đồng bộ thất bại, sẽ tự động đồng bộ sau 10 phút');
          }
        }
      }
      setCourseDialogOpen(false);
      setEditingCourse(null);
      resetForm();
      onRefetch();
    } catch {
      toast.error('Lưu cự ly thất bại');
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleRemoveCourse(courseId: string) {
    if (!token) return;
    try {
      const { error } = await racesControllerRemoveCourse({
        path: { id: raceId, courseId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success('Đã xóa cự ly!');
      onRefetch();
    } catch {
      toast.error('Xóa cự ly thất bại');
    }
  }

  async function handleForceSync(courseId: string) {
    if (!token) return;
    setSyncingCourseId(courseId);
    try {
      const { error } = await adminControllerForceSync({
        path: { raceId, courseId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success('Đồng bộ thành công!');
    } catch {
      toast.error('Đồng bộ thất bại');
    } finally {
      setSyncingCourseId(null);
    }
  }

  // F-068 — Open Reset confirmation dialog (mutation handled inside dialog).
  function openResetDialog(courseId: string, courseName: string) {
    setResetDialog({ open: true, courseId, courseName });
  }

  // F-068 — Open Clear apiUrl confirmation dialog.
  function openClearApiUrlDialog(courseId: string, courseName: string) {
    setClearApiUrlDialog({ open: true, courseId, courseName });
  }

  async function handleExportCSV(courseId: string, courseName: string) {
    try {
      const { data: body, error } = await raceResultControllerGetRaceResults({
        query: {
          raceId,
          course_id: courseId,
          pageNo: 1,
          pageSize: 100,
          sortField: 'OverallRank',
          sortDirection: 'ASC',
        },
      });
      if (error) {
        toast.error('Không thể tải dữ liệu');
        return;
      }
      type CsvRow = {
        OverallRank?: string | number;
        Bib?: string;
        Name?: string;
        Gender?: string;
        Category?: string;
        ChipTime?: string;
        GunTime?: string;
        Pace?: string;
        Gap?: string;
        Nationality?: string;
      };
      const results = ((body as { data?: CsvRow[] })?.data ?? []) as CsvRow[];
      if (results.length === 0) {
        toast.error('Không có dữ liệu để xuất');
        return;
      }
      const headers = [
        'Rank',
        'BIB',
        'Name',
        'Gender',
        'Category',
        'ChipTime',
        'GunTime',
        'Pace',
        'Gap',
        'Nationality',
      ];
      const csvRows = [headers.join(',')];
      for (const r of results) {
        csvRows.push(
          [
            r.OverallRank,
            r.Bib,
            `"${(r.Name || '').replace(/"/g, '""')}"`,
            r.Gender,
            r.Category,
            r.ChipTime,
            r.GunTime,
            r.Pace,
            r.Gap,
            r.Nationality,
          ].join(','),
        );
      }
      const blob = new Blob(['﻿' + csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${race.title || 'race'}-${courseName || courseId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Đã xuất ${results.length} kết quả`);
    } catch {
      toast.error('Xuất CSV thất bại');
    }
  }

  return (
    <section id="course" className="scroll-mt-24" aria-labelledby="course-heading">
      <CourseMapFullpageLinkCard raceId={raceId} />
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle id="course-heading">Cự ly</CardTitle>
            <CardDescription>Quản lý các cự ly của giải</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4 mr-1" />
            Thêm
          </Button>
          <CourseDialog
            open={courseDialogOpen}
            onOpenChange={(open) => {
              setCourseDialogOpen(open);
              if (!open) {
                setEditingCourse(null);
                resetForm();
              }
            }}
            raceId={raceId}
            editingCourse={editingCourse}
            courseForm={courseForm}
            setCourseForm={setCourseForm}
            onSubmit={handleSaveCourse}
            isSubmitting={savingCourse}
            token={token}
          />
        </CardHeader>
        <CardContent>
          <CourseTable
            raceId={raceId}
            courses={race.courses ?? []}
            syncingCourseId={syncingCourseId}
            resettingCourseId={resettingCourseId}
            pollProgressByCourse={pollProgressByCourse}
            onExportCsv={handleExportCSV}
            onForceSync={handleForceSync}
            onResetData={openResetDialog}
            onClearApiUrl={openClearApiUrlDialog}
            onClone={openClone}
            onEdit={openEdit}
            onRemove={handleRemoveCourse}
            onAdd={openAdd}
          />
        </CardContent>
      </Card>

      {/* F-068 — Reset confirmation dialog (cron-aware + race-live typed confirm) */}
      {resetDialog.open && (
        <ResetDataConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setResetDialog({ open: false });
          }}
          raceId={raceId}
          raceTitle={race?.title ?? ''}
          raceStatus={raceLiveStatus}
          courseId={resetDialog.courseId}
          courseName={resetDialog.courseName}
          stats={
            queryClient.getQueryData<import('@/lib/course-data-ops-api').CourseDataStatsDto>([
              'course-data-stats',
              raceId,
              resetDialog.courseId,
            ])
          }
          onResetComplete={(combo) => {
            void startPostResetPoll(resetDialog.courseId, combo);
          }}
        />
      )}

      {/* F-068 — Clear apiUrl confirmation dialog */}
      {clearApiUrlDialog.open && (
        <ClearApiUrlConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setClearApiUrlDialog({ open: false });
          }}
          raceId={raceId}
          raceTitle={race?.title ?? ''}
          raceStatus={raceLiveStatus}
          courseId={clearApiUrlDialog.courseId}
          courseName={clearApiUrlDialog.courseName}
          stats={
            queryClient.getQueryData<import('@/lib/course-data-ops-api').CourseDataStatsDto>([
              'course-data-stats',
              raceId,
              clearApiUrlDialog.courseId,
            ])
          }
        />
      )}
    </section>
  );
}

export default CourseSection;
