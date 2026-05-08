/**
 * F-008 — Checkpoint Health Matrix (NEW critical missing in F-005).
 *
 * Per Canvas 03 BOTTOM-RIGHT panel: per-course × per-CP grid với colored cells
 * (green ≥90% / amber 70-90% / red <70%) + per-course aggregate overallPercent.
 *
 * VN microcopy via `vnHealthLabel()` per BR-CC-21:
 *   ≥90% → TỐT
 *   70-90% → CHÚ Ý
 *   <70% → KIỂM TRA THIẾT BỊ
 *
 * Mobile <768px: horizontal scroll preserved. Below <500px: stack per-course.
 */

import type { JSX } from 'react';
import type { CourseHealth } from '@/lib/timing-alert-api';
import { vnHealthLabel } from '@/lib/vn-microcopy';

interface CheckpointHealthMatrixProps {
  matrix: CourseHealth[];
}

function bucketClass(pct: number): {
  bg: string;
  fg: string;
  border: string;
  health: 'good' | 'warn' | 'fail';
} {
  if (pct >= 90)
    return {
      bg: '#DCFCE7',
      fg: '#166534',
      border: '#86EFAC',
      health: 'good',
    };
  if (pct >= 70)
    return {
      bg: '#FEF3C7',
      fg: '#92400E',
      border: '#FCD34D',
      health: 'warn',
    };
  return {
    bg: '#FEE2E2',
    fg: '#991B1B',
    border: '#FCA5A5',
    health: 'fail',
  };
}

export function CheckpointHealthMatrix({
  matrix,
}: CheckpointHealthMatrixProps): JSX.Element {
  if (!matrix || matrix.length === 0) {
    return (
      <section
        className="overflow-hidden rounded-[14px] border bg-white"
        style={{
          borderColor: 'var(--5s-border)',
          boxShadow: 'var(--shadow-xs)',
        }}
        data-testid="health-matrix-empty"
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--5s-border)' }}>
          <h3
            className="text-[15px] font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Checkpoint Health Matrix
          </h3>
          <div className="text-[11px] text-stone-500">Tổng quan tất cả courses</div>
        </div>
        <div className="p-6 text-center text-sm text-stone-500">
          Chưa có data — race ở trạng thái draft hoặc chưa có checkpoint config.
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-[14px] border bg-white"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
      data-testid="health-matrix"
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <h3
          className="text-[15px] font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Checkpoint Health Matrix
        </h3>
        <div className="text-[11px] text-stone-500">
          Tổng quan tất cả courses
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="flex flex-col gap-3 min-w-[480px]">
          {matrix.map((course) => {
            const overall = bucketClass(course.overallPercent);
            return (
              <div
                key={course.courseId}
                className="rounded-[10px] border p-3"
                style={{ borderColor: 'var(--5s-border)' }}
                data-testid={`health-row-${course.courseId}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px] font-extrabold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {course.courseName}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      {course.totalAthletes.toLocaleString('vi-VN')} VĐV
                    </span>
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider"
                    style={{
                      background: overall.bg,
                      color: overall.fg,
                      borderColor: overall.border,
                    }}
                    data-testid={`health-overall-${course.courseId}`}
                  >
                    <span
                      className="text-[12px]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {course.overallPercent.toFixed(0)}%
                    </span>
                    <span>{vnHealthLabel(overall.health)}</span>
                  </div>
                </div>
                {course.checkpoints.length === 0 ? (
                  <div className="text-[11px] text-stone-500">
                    — Chưa có checkpoint config
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {course.checkpoints.map((cp) => {
                      const cls = bucketClass(cp.healthPercent);
                      return (
                        <div
                          key={cp.key}
                          className="flex min-w-[88px] flex-col rounded-md border px-2.5 py-1.5"
                          style={{
                            background: cls.bg,
                            borderColor: cls.border,
                            color: cls.fg,
                          }}
                          title={`${cp.name}: ${cp.current}/${cp.expected} VĐV qua (${cp.healthPercent.toFixed(1)}%)`}
                          data-testid={`health-cell-${course.courseId}-${cp.key}`}
                        >
                          <span
                            className="text-[10px] font-extrabold uppercase tracking-wider"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            {cp.name}
                          </span>
                          <span
                            className="text-[12px] font-bold"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {cp.current}/{cp.expected}
                          </span>
                          <span
                            className="text-[10px] font-bold"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {cp.healthPercent.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
