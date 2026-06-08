/**
 * FEATURE-073 — Pure aggregation for course/ticket-type capacity.
 * Quota lives at ticket_type level (max_participate + remained_ticket);
 * race_course.max_participate is unreliable (mostly placeholder=1) → ignored.
 * sold = quota - remaining (clamped ≥0). quota 0/null → unlimited (no bar).
 */

export interface RawCapacityRow {
  course_id: number | string;
  course_name: string | null;
  tt_id: number | string;
  type_name: string | null;
  quota: number | string | null; // tt.max_participate
  remaining: number | string | null; // tt.remained_ticket
}

export interface CapacityTicketType {
  ticketTypeId: number;
  name: string;
  quota: number;
  sold: number;
  remaining: number;
  unlimited: boolean;
  pctFilled: number; // 0..100, 0 when unlimited
}

export interface CapacityCourse {
  courseId: number;
  courseName: string;
  quota: number;
  sold: number;
  remaining: number;
  unlimited: boolean; // true if ALL ticket types unlimited
  pctFilled: number;
  ticketTypes: CapacityTicketType[];
}

export interface CapacityAggregate {
  raceId: number;
  courses: CapacityCourse[];
}

function n(v: number | string | null | undefined): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function pct(sold: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (sold / quota) * 100)) * 10) / 10;
}

export function aggregateCapacity(
  raceId: number,
  rows: RawCapacityRow[],
): CapacityAggregate {
  const byCourse = new Map<number, CapacityCourse>();

  for (const r of rows) {
    const courseId = n(r.course_id);
    const quota = n(r.quota);
    const remaining = Math.min(n(r.remaining), quota || n(r.remaining)); // remaining never > quota
    const unlimited = quota <= 0;
    const sold = unlimited ? 0 : Math.max(0, quota - remaining);

    const tt: CapacityTicketType = {
      ticketTypeId: n(r.tt_id),
      name: (r.type_name as string | null)?.trim() || '—',
      quota,
      sold,
      remaining: unlimited ? 0 : Math.max(0, remaining),
      unlimited,
      pctFilled: pct(sold, quota),
    };

    let course = byCourse.get(courseId);
    if (!course) {
      course = {
        courseId,
        courseName: (r.course_name as string | null)?.trim() || '—',
        quota: 0,
        sold: 0,
        remaining: 0,
        unlimited: true,
        pctFilled: 0,
        ticketTypes: [],
      };
      byCourse.set(courseId, course);
    }
    course.ticketTypes.push(tt);
    course.quota += quota;
    course.sold += sold;
    course.remaining += tt.remaining;
    if (!unlimited) course.unlimited = false;
  }

  const courses = [...byCourse.values()].map((c) => ({
    ...c,
    pctFilled: pct(c.sold, c.quota),
  }));
  // sort by %filled desc (most-full courses first — actionable)
  courses.sort((a, b) => b.pctFilled - a.pctFilled);

  return { raceId, courses };
}
