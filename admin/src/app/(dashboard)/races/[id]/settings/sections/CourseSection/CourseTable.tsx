'use client';

/**
 * F-014 BR-AS-49 — Course table with per-row actions.
 *
 * F-068 extends the row:
 *  - NEW "Tình trạng" column (md+) rendering CourseDataStatsBadge (BR-68-01..06).
 *  - NEW PlugZap action button (🔌 Tắt auto-sync) inserted between Reset and
 *    Clone — only visible when hasApiUrl=true.
 *  - Reset button tooltip now shows row count dynamically ("Xóa dữ liệu (576 kết quả)")
 *    and disables when rowCount=0.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  PlugZap,
} from 'lucide-react';
import { CourseDataStatsBadge } from '@/components/course-data-ops';
import { useCourseDataStats } from '@/lib/course-data-ops-hooks';
import type { Course } from '../section-shared.types';

interface CourseTableProps {
  raceId: string;
  courses: Course[];
  syncingCourseId: string | null;
  resettingCourseId: string | null;
  /** F-068 BR-68-18 — per-course post-reset poll progress (null when idle). */
  pollProgressByCourse?: Record<string, { attempt: number; total: number } | undefined>;
  onExportCsv: (courseId: string, courseName: string) => void;
  onForceSync: (courseId: string) => void;
  /** F-068: pass courseName so dialog can display it in confirm copy. */
  onResetData: (courseId: string, courseName: string) => void;
  /** F-068: NEW handler for Clear apiUrl confirm dialog. */
  onClearApiUrl: (courseId: string, courseName: string) => void;
  onClone: (course: Course) => void;
  onEdit: (course: Course) => void;
  onRemove: (courseId: string) => void;
  onAdd: () => void;
}

interface CourseRowProps {
  raceId: string;
  course: Course;
  syncingCourseId: string | null;
  resettingCourseId: string | null;
  pollProgress?: { attempt: number; total: number } | null;
  onExportCsv: (courseId: string, courseName: string) => void;
  onForceSync: (courseId: string) => void;
  onResetData: (courseId: string, courseName: string) => void;
  onClearApiUrl: (courseId: string, courseName: string) => void;
  onClone: (course: Course) => void;
  onEdit: (course: Course) => void;
  onRemove: (courseId: string) => void;
}

function CourseRow(props: CourseRowProps) {
  const {
    raceId,
    course,
    syncingCourseId,
    resettingCourseId,
    pollProgress,
    onExportCsv,
    onForceSync,
    onResetData,
    onClearApiUrl,
    onClone,
    onEdit,
    onRemove,
  } = props;

  // F-068 BR-68-12 — 5s polling per course (TanStack staleTime 0)
  const statsQuery = useCourseDataStats(raceId, course.courseId);
  const stats = statsQuery.data;

  const isResetting = resettingCourseId === course.courseId;
  const isSyncing = syncingCourseId === course.courseId;
  const rowCount = stats?.rowCount ?? 0;
  const hasApiUrl = Boolean(stats?.hasApiUrl);
  const cronInProgress = stats?.cronStatus === 'in_progress';

  const resetTooltip = stats
    ? `Xóa dữ liệu (${rowCount.toLocaleString('vi-VN')} kết quả)`
    : 'Xóa dữ liệu';

  const resetDisabled =
    isResetting || rowCount === 0 || cronInProgress;
  const resetDisabledReason = cronInProgress
    ? 'Chờ sync xong'
    : rowCount === 0
      ? 'Không có dữ liệu để xóa'
      : undefined;

  return (
    <TableRow key={course.courseId} className="text-base">
      <TableCell className="font-medium py-4">
        <div className="flex items-center gap-3">
          {course.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={course.imageUrl}
              alt=""
              className="size-14 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div>
            <div className="text-base font-semibold">{course.name}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-base text-muted-foreground py-4">
        {course.distance || '-'}
      </TableCell>
      <TableCell className="hidden md:table-cell text-base text-muted-foreground py-4">
        {course.startTime
          ? (() => {
              const m = course.startTime!.match(
                /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              return m
                ? `${m[4]}:${m[5]} - ${m[3]}/${m[2]}`
                : course.startTime;
            })()
          : '-'}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[240px] truncate py-4">
        {course.apiUrl || '-'}
      </TableCell>
      <TableCell className="hidden md:table-cell py-4">
        <CourseDataStatsBadge
          stats={stats}
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          pollProgress={pollProgress ?? null}
        />
      </TableCell>
      <TableCell className="text-right py-4">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onExportCsv(course.courseId, course.name)}
            title="Xuất CSV"
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onForceSync(course.courseId)}
            disabled={isSyncing}
            title="Ép đồng bộ"
          >
            <RefreshCw
              className={`size-4 ${isSyncing ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onResetData(course.courseId, course.name)}
            disabled={resetDisabled}
            title={resetDisabledReason ?? resetTooltip}
          >
            <RotateCcw className="size-4" />
          </Button>
          {/* F-068: Clear apiUrl button — only when hasApiUrl=true */}
          {hasApiUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onClearApiUrl(course.courseId, course.name)}
              title="Tắt auto-sync (clear apiUrl)"
            >
              <PlugZap className="size-4 text-amber-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onClone(course)}
            title="Nhân bản cự ly"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(course)}
            title="Sửa"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(course.courseId)}
            title="Xóa"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CourseTable(props: CourseTableProps) {
  const {
    raceId,
    courses,
    syncingCourseId,
    resettingCourseId,
    pollProgressByCourse,
    onExportCsv,
    onForceSync,
    onResetData,
    onClearApiUrl,
    onClone,
    onEdit,
    onRemove,
    onAdd,
  } = props;

  if (!courses || courses.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Chưa có cự ly nào. Nhấn &quot;Thêm&quot; để bắt đầu.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="text-base">
            <TableHead className="text-base py-4">Tên</TableHead>
            <TableHead className="hidden sm:table-cell text-base py-4">
              Khoảng cách
            </TableHead>
            <TableHead className="hidden md:table-cell text-base py-4">
              Giờ xuất phát
            </TableHead>
            <TableHead className="hidden lg:table-cell text-base py-4">
              Đường dẫn API
            </TableHead>
            <TableHead className="hidden md:table-cell text-base py-4">
              Tình trạng
            </TableHead>
            <TableHead className="text-right text-base py-4">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((course) => (
            <CourseRow
              key={course.courseId}
              raceId={raceId}
              course={course}
              syncingCourseId={syncingCourseId}
              resettingCourseId={resettingCourseId}
              pollProgress={pollProgressByCourse?.[course.courseId]}
              onExportCsv={onExportCsv}
              onForceSync={onForceSync}
              onResetData={onResetData}
              onClearApiUrl={onClearApiUrl}
              onClone={onClone}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </TableBody>
      </Table>

      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" />
          Thêm cự ly
        </Button>
      </div>
    </>
  );
}

export default CourseTable;
