"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inclusiveMonthCount,
  presetLast3Months,
  presetPreviousMonth,
  presetPreviousQuarter,
  presetThisMonth,
  yearOptionsAround,
  type YearMonth,
} from "@/lib/period-helpers";
import { useMemo } from "react";

const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const MAX_RANGE_MONTHS = 12;

export type MonthRangeValue = {
  from: YearMonth;
  to: YearMonth;
};

export type MonthRangePickerProps = {
  value: MonthRangeValue;
  onChange: (next: MonthRangeValue) => void;
  /** Centre year of dropdown (typically currentYear). */
  centerYear?: number;
};

export function MonthRangePicker({
  value,
  onChange,
  centerYear,
}: MonthRangePickerProps) {
  const yearOptions = useMemo(
    () => yearOptionsAround(centerYear ?? new Date().getFullYear()),
    [centerYear],
  );

  const monthCount = inclusiveMonthCount(value.from, value.to);
  const isInvalidOrder = monthCount < 1;
  const isOverMax = monthCount > MAX_RANGE_MONTHS;

  const setFrom = (next: Partial<YearMonth>) => {
    onChange({ ...value, from: { ...value.from, ...next } });
  };
  const setTo = (next: Partial<YearMonth>) => {
    onChange({ ...value, to: { ...value.to, ...next } });
  };

  const applyPreset = (preset: () => MonthRangeValue) => onChange(preset());

  return (
    <div className="flex flex-col gap-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => applyPreset(presetThisMonth)}
        >
          Tháng này
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => applyPreset(presetPreviousMonth)}
        >
          Tháng trước
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => applyPreset(presetLast3Months)}
        >
          3 tháng gần nhất
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => applyPreset(presetPreviousQuarter)}
        >
          Quý trước
        </Button>
      </div>

      {/* Range dropdowns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Từ tháng
          </span>
          <div className="flex gap-2">
            <Select
              value={String(value.from.month)}
              onValueChange={(v) => setFrom({ month: Number(v) })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(value.from.year)}
              onValueChange={(v) => setFrom({ year: Number(v) })}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Đến tháng
          </span>
          <div className="flex gap-2">
            <Select
              value={String(value.to.month)}
              onValueChange={(v) => setTo({ month: Number(v) })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(value.to.year)}
              onValueChange={(v) => setTo({ year: Number(v) })}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Confirmation row + validation */}
      <div className="text-sm">
        {isInvalidOrder ? (
          <span className="text-destructive">
            Đến tháng phải ≥ Từ tháng.
          </span>
        ) : isOverMax ? (
          <span className="text-destructive">
            Tối đa {MAX_RANGE_MONTHS} tháng (đang chọn {monthCount}).
          </span>
        ) : (
          <span className="text-muted-foreground">
            Kỳ:{" "}
            <span className="font-medium text-foreground">
              01/{String(value.from.month).padStart(2, "0")}/
              {value.from.year} —{" "}
              {/* end day computed via inline lastDayOfMonth — keep readable */}
              {String(
                new Date(
                  Date.UTC(value.to.year, value.to.month, 0),
                ).getUTCDate(),
              ).padStart(2, "0")}
              /{String(value.to.month).padStart(2, "0")}/{value.to.year}
            </span>{" "}
            ({monthCount} {monthCount === 1 ? "tháng" : "tháng"})
          </span>
        )}
      </div>
    </div>
  );
}
