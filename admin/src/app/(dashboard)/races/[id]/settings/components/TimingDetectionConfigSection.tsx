"use client";

/**
 * F-010 — Timing Detection Config Section
 *
 * Admin UI cho 4 config knobs trên Settings tab:
 *   - course_type preset (ROAD | TRAIL | ULTRA)
 *   - pace_buffer (1.01–2.00)
 *   - pace_alert_threshold (0.20–0.95)
 *   - confidence_multiplier (0.05–1.00)
 *
 * BR-AF-23 — additive: insert ABOVE legacy 1687-line editor. Reads + writes
 * `timing_alert_configs` collection via `timingAlertAdminControllerUpsertConfig`
 * SDK call (preserves existing toggle pattern).
 *
 * Preset behavior (BR-FC-13):
 *   - Click ROAD/TRAIL/ULTRA → all 4 fields fill with preset defaults
 *   - User can override individual fields after preset selection
 *   - Save → PATCH config doc; SDK regen ensures types in sync
 */

import { useEffect, useState } from "react";
import {
  timingAlertAdminControllerGetConfig,
  timingAlertAdminControllerUpsertConfig,
} from "@/lib/api-generated";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TimingFormulaTooltipContent from "./TimingFormulaTooltipContent";
import TimingPresetComparisonTable from "./TimingPresetComparisonTable";
import TimingPresetRationalePanel from "./TimingPresetRationalePanel";
import {
  TIMING_PRESETS,
  PRESET_LABELS_VI,
  type CourseType,
} from "./timing-presets.constant";

interface FormState {
  course_type: CourseType | null;
  pace_buffer: number;
  pace_alert_threshold: number;
  overdue_threshold_minutes: number;
  confidence_multiplier: number;
  top_n_alert: number;
  enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  course_type: null,
  pace_buffer: 1.10,
  pace_alert_threshold: 0.80,
  overdue_threshold_minutes: 30,
  confidence_multiplier: 0.20,
  top_n_alert: 3,
  enabled: false,
};

interface Props {
  raceId: string;
}

export default function TimingDetectionConfigSection({ raceId }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await timingAlertAdminControllerGetConfig({
          path: { raceId },
          headers: authHeaders(),
          throwOnError: true,
        });
        if (cancelled) return;
        const data = res.data;
        if (data) {
          setForm({
            course_type: data.course_type,
            pace_buffer: data.pace_buffer,
            pace_alert_threshold: data.pace_alert_threshold,
            overdue_threshold_minutes: data.overdue_threshold_minutes,
            confidence_multiplier: data.confidence_multiplier,
            top_n_alert: data.top_n_alert,
            enabled: data.enabled,
          });
        }
      } catch (e) {
        if (cancelled) return;
        // 404 = config chưa tạo — UI vẫn render với defaults, user bật enable + save tạo
        const message = e instanceof Error ? e.message : String(e);
        if (!/404/.test(message)) {
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  const applyPreset = (preset: CourseType) => {
    const values = TIMING_PRESETS[preset];
    setForm((prev) => ({
      ...prev,
      course_type: preset,
      pace_buffer: values.paceBuffer,
      pace_alert_threshold: values.paceAlertThreshold,
      overdue_threshold_minutes: values.overdueMinutes,
      confidence_multiplier: values.confidenceMultiplier,
    }));
  };

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateRange = (n: number, min: number, max: number): boolean =>
    Number.isFinite(n) && n >= min && n <= max;

  const isValid =
    validateRange(form.pace_buffer, 1.01, 2.0) &&
    validateRange(form.pace_alert_threshold, 0.2, 0.95) &&
    validateRange(form.confidence_multiplier, 0.05, 1.0) &&
    validateRange(form.overdue_threshold_minutes, 1, 180) &&
    validateRange(form.top_n_alert, 1, 50);

  const handleSave = async () => {
    if (!isValid) return;
    try {
      setSaving(true);
      setError(null);
      await timingAlertAdminControllerUpsertConfig({
        path: { raceId },
        headers: authHeaders(),
        body: {
          enabled: form.enabled,
          poll_interval_seconds: 90,
          overdue_threshold_minutes: form.overdue_threshold_minutes,
          top_n_alert: form.top_n_alert,
          course_type: form.course_type ?? undefined,
          pace_buffer: form.pace_buffer,
          pace_alert_threshold: form.pace_alert_threshold,
          confidence_multiplier: form.confidence_multiplier,
        },
        throwOnError: true,
      });
      setSavedAt(new Date().toISOString());
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Lưu cấu hình thất bại: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Cấu hình phát hiện timing (F-010)
            </CardTitle>
            <CardDescription>
              Chọn preset theo loại race (ROAD / TRAIL / ULTRA) hoặc tùy chỉnh
              thủ công 4 thông số dưới đây. Ảnh hưởng tới detection engine.
            </CardDescription>
          </div>
          {form.course_type && (
            <Badge variant="outline" className="border-amber-400">
              Preset: {PRESET_LABELS_VI[form.course_type]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset selector buttons */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIMING_PRESETS) as CourseType[]).map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={form.course_type === preset ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset(preset)}
                disabled={loading || saving}
              >
                {PRESET_LABELS_VI[preset]}
              </Button>
            ))}
          </div>
          {/* F-012 Surface 3 — "Tại sao preset này?" rationale panel */}
          <TimingPresetRationalePanel currentPreset={form.course_type} />
        </div>

        {/* F-012 Surface 2 — Preset comparison expandable table */}
        <TimingPresetComparisonTable currentPreset={form.course_type} />

        {/* 4 numeric inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="pace_buffer">
                Pace buffer (1.01 – 2.00)
                <span className="ml-1 text-xs text-muted-foreground">
                  — kích flag chậm pace
                </span>
              </Label>
              <TimingFormulaTooltipContent field="pace_buffer" />
            </div>
            <Input
              id="pace_buffer"
              type="number"
              step="0.01"
              min={1.01}
              max={2.0}
              value={form.pace_buffer}
              onChange={(e) =>
                updateField("pace_buffer", Number(e.target.value))
              }
              disabled={loading || saving}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="pace_alert_threshold">
                Pace alert threshold (0.20 – 0.95)
                <span className="ml-1 text-xs text-muted-foreground">
                  — split pace drop alert
                </span>
              </Label>
              <TimingFormulaTooltipContent field="pace_alert_threshold" />
            </div>
            <Input
              id="pace_alert_threshold"
              type="number"
              step="0.01"
              min={0.2}
              max={0.95}
              value={form.pace_alert_threshold}
              onChange={(e) =>
                updateField("pace_alert_threshold", Number(e.target.value))
              }
              disabled={loading || saving}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="overdue_threshold_minutes">
                Overdue threshold (1 – 180 phút)
                <span className="ml-1 text-xs text-muted-foreground">
                  — gap min trước flag PHANTOM
                </span>
              </Label>
              <TimingFormulaTooltipContent field="overdue_threshold" />
            </div>
            <Input
              id="overdue_threshold_minutes"
              type="number"
              step="1"
              min={1}
              max={180}
              value={form.overdue_threshold_minutes}
              onChange={(e) =>
                updateField(
                  "overdue_threshold_minutes",
                  Number(e.target.value),
                )
              }
              disabled={loading || saving}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="confidence_multiplier">
                Confidence multiplier (0.05 – 1.00)
                <span className="ml-1 text-xs text-muted-foreground">
                  — projected rank trust ratio
                </span>
              </Label>
              <TimingFormulaTooltipContent field="confidence_multiplier" />
            </div>
            <Input
              id="confidence_multiplier"
              type="number"
              step="0.01"
              min={0.05}
              max={1.0}
              value={form.confidence_multiplier}
              onChange={(e) =>
                updateField("confidence_multiplier", Number(e.target.value))
              }
              disabled={loading || saving}
            />
          </div>
        </div>

        {/* Error/success feedback */}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {savedAt && !error && (
          <p className="text-sm text-emerald-700">
            Đã lưu cấu hình lúc {new Date(savedAt).toLocaleTimeString("vi-VN")}.
          </p>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-xs text-muted-foreground">
            Thay đổi áp dụng từ poll cycle tiếp theo (~90s).
          </span>
          <Button
            onClick={handleSave}
            disabled={loading || saving || !isValid}
          >
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
