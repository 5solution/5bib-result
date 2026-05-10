"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface TimeToFillCourse {
  courseId: number;
  courseName: string;
  raceId: number;
  raceName: string;
  openAt: string | null;
  filledAt: string | null;
  hoursToFill: number | null;
  fillRate: number;
  status: string;
  quota: number;
  paid: number;
}

export interface TimeToFillData {
  courses: TimeToFillCourse[];
  medianHoursToFill: number | null;
}

interface Props {
  data: TimeToFillData | null;
  loading: boolean;
}

export function TimeToFillTable({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Time-to-Fill + Fill Rate</CardTitle>
        <p className="text-xs text-muted-foreground">
          Median:{" "}
          {data?.medianHoursToFill != null ? `${data.medianHoursToFill}h` : "—"}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !data || data.courses.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">Course</th>
                  <th className="py-1 text-right font-medium">Fill Rate</th>
                  <th className="py-1 text-right font-medium">Time-to-Fill</th>
                </tr>
              </thead>
              <tbody>
                {data.courses.slice(0, 8).map((c) => (
                  <tr key={c.courseId} className="border-t border-stone-200">
                    <td className="py-1.5">
                      <div className="truncate">{c.courseName}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {c.raceName}
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      <div>{c.fillRate.toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.paid}/{c.quota}
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.hoursToFill != null ? `${c.hoursToFill}h` : "Đang mở"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
