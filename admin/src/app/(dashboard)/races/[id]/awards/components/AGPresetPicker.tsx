'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRecompute } from '../hooks/useRecompute';
import {
  PRESET_KEYS,
  type PresetKey,
} from '../awards.constant';
import { VN } from '../awards.microcopy';

interface CourseRow {
  courseId: string;
  name: string;
  ageGroupPreset?: PresetKey;
}

interface Props {
  raceId: string;
  courses: CourseRow[];
}

/**
 * F-019 settings surface — AG preset picker per course.
 * Phase 1 read-only view (preset chỉ display, edit sẽ qua Settings page edit form
 * trong races/[id]/edit). "Tính lại AG" trigger recompute manual (BR-AG-36).
 */
export function AGPresetPicker({ raceId, courses }: Props) {
  const recompute = useRecompute(raceId);
  const [selectedCourse, setSelectedCourse] = useState<string | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cấu hình lứa tuổi (AG) per cự ly</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-stone-600">
          Mặc định: <strong>vn_road_default</strong> cho road / <strong>trail_itra</strong> cho trail. Override per course
          qua trang chỉnh sửa race.
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-2 py-1">Course</th>
              <th className="px-2 py-1">Preset</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {courses.map((c) => (
              <tr key={c.courseId}>
                <td className="px-2 py-1 font-medium">{c.name}</td>
                <td className="px-2 py-1 font-mono text-xs">
                  {c.ageGroupPreset ?? '(default)'}
                </td>
                <td className="px-2 py-1 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={recompute.isPending}
                    onClick={() => {
                      setSelectedCourse(c.courseId);
                      recompute.mutate({ courseId: c.courseId });
                    }}
                    title={VN.RECOMPUTE_TOOLTIP}
                  >
                    {recompute.isPending && selectedCourse === c.courseId
                      ? '...'
                      : VN.RECOMPUTE_BUTTON}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs text-stone-500">
          Phase 1 ship 5 presets: {PRESET_KEYS.map((k) => VN.PRESET_LABELS[k]).join(' · ')}
        </div>
        {recompute.isSuccess && (
          <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
            {VN.TOAST_RECOMPUTE_OK} (
            {recompute.data?.podiumsCreatedOrUpdated} podiums,{' '}
            {recompute.data?.warningsCreated} warnings,{' '}
            {recompute.data?.durationMs}ms)
          </div>
        )}
        {recompute.isError && (
          <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
            {(recompute.error as Error)?.message ?? VN.TOAST_RECOMPUTE_FAIL}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
