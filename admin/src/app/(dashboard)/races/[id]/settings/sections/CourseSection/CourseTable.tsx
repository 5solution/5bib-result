'use client';

/**
 * F-014 BR-AS-49 — Course table with 7 per-row actions.
 *
 * Verbatim port of legacy course table (page.tsx lines 1177–1271).
 * Per-row loading state tracked via parent-passed `syncingCourseId` /
 * `resettingCourseId` ids.
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
} from 'lucide-react';
import type { Course } from '../section-shared.types';

interface CourseTableProps {
  courses: Course[];
  syncingCourseId: string | null;
  resettingCourseId: string | null;
  onExportCsv: (courseId: string, courseName: string) => void;
  onForceSync: (courseId: string) => void;
  onResetData: (courseId: string) => void;
  onClone: (course: Course) => void;
  onEdit: (course: Course) => void;
  onRemove: (courseId: string) => void;
  onAdd: () => void;
}

export function CourseTable(props: CourseTableProps) {
  const {
    courses,
    syncingCourseId,
    resettingCourseId,
    onExportCsv,
    onForceSync,
    onResetData,
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
            <TableHead className="text-right text-base py-4">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((course) => (
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
                    disabled={syncingCourseId === course.courseId}
                    title="Ép đồng bộ"
                  >
                    <RefreshCw
                      className={`size-4 ${
                        syncingCourseId === course.courseId ? 'animate-spin' : ''
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onResetData(course.courseId)}
                    disabled={resettingCourseId === course.courseId}
                    title="Xóa dữ liệu"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
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
