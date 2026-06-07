'use client';

/**
 * F-068 Reset Data confirmation dialog — cron-aware + race-live typed confirm.
 *
 * Routes to the right endpoint based on the "Tắt auto-sync trước khi xóa"
 * checkbox (Danny chốt #1):
 *  - checked (default when hasApiUrl=true) → POST /disable-and-reset
 *  - unchecked → POST /reset-data (warning: cron may re-insert in N minutes)
 *
 * Race=live (Danny chốt #2) forces a typed confirmation gate — admin must type
 * the exact courseName before the destructive button enables.
 *
 * BR-68-18 post-reset poll snapshot lives in the parent (CourseSection) — this
 * dialog just initiates the mutation and closes.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import type { CourseDataStatsDto } from '@/lib/course-data-ops-api';
import {
  useDisableAndResetCourse,
  useResetCourseData,
} from '@/lib/course-data-ops-hooks';

export type RaceLiveStatus = 'draft' | 'pre_race' | 'live' | 'ended' | undefined;

export interface ResetDataConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raceId: string;
  raceTitle: string;
  raceStatus: RaceLiveStatus;
  courseId: string;
  courseName: string;
  stats: CourseDataStatsDto | undefined;
  /** Fired on successful reset to trigger BR-68-18 poll snapshot in parent. */
  onResetComplete?: (combo: boolean) => void;
}

function formatHHmmUtcPlus7(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  }).format(d);
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / 60_000));
}

export function ResetDataConfirmDialog(props: ResetDataConfirmDialogProps) {
  const {
    open,
    onOpenChange,
    raceId,
    raceTitle,
    raceStatus,
    courseId,
    courseName,
    stats,
    onResetComplete,
  } = props;

  const hasApiUrl = Boolean(stats?.hasApiUrl);
  const isLive = raceStatus === 'live';

  const [disableAutoSync, setDisableAutoSync] = useState<boolean>(hasApiUrl);
  const [typedConfirm, setTypedConfirm] = useState<string>('');

  // Reset internal state when dialog opens/closes or course changes
  useEffect(() => {
    if (open) {
      setDisableAutoSync(hasApiUrl);
      setTypedConfirm('');
    }
  }, [open, courseId, hasApiUrl]);

  const resetMut = useResetCourseData(raceId, courseId);
  const disableAndResetMut = useDisableAndResetCourse(raceId, courseId);
  const isSubmitting = resetMut.isPending || disableAndResetMut.isPending;

  const typedConfirmMatches = !isLive || typedConfirm === courseName;
  const canConfirm = !isSubmitting && typedConfirmMatches;

  const minutesToNextCron = useMemo(
    () => minutesUntil(stats?.nextCronAt ?? null),
    [stats?.nextCronAt],
  );

  const handleConfirm = async () => {
    try {
      if (disableAutoSync && hasApiUrl) {
        const result = await disableAndResetMut.mutateAsync({
          confirmedLive: isLive ? true : undefined,
        });
        toast.success(
          `Đã tắt auto-sync + xóa ${result.deletedCount} kết quả — course ${courseName}. Data sẽ KHÔNG tự đồng bộ lại.`,
        );
        onResetComplete?.(true);
      } else {
        const result = await resetMut.mutateAsync({
          confirmedLive: isLive ? true : undefined,
        });
        if (result.hasApiUrl && result.nextCronAt) {
          const mins = minutesUntil(result.nextCronAt);
          toast.success(
            `Đã xóa ${result.deletedCount} kết quả — course ${courseName}. ` +
              (mins !== null
                ? `Lần sync tiếp theo: ${mins} phút nữa.`
                : `Lần sync tiếp theo: ${formatHHmmUtcPlus7(result.nextCronAt)} UTC+7.`),
          );
        } else {
          toast.success(
            `Đã xóa ${result.deletedCount} kết quả — course ${courseName}. Auto-sync đang tắt.`,
          );
        }
        onResetComplete?.(false);
      }
      onOpenChange(false);
    } catch (err: any) {
      // Race-live edge case (Danny chốt D)
      const code = err?.code;
      if (code === 'RACE_IS_LIVE_CONFIRM_REQUIRED') {
        toast.error('Race vừa chuyển LIVE, vui lòng xác nhận lại');
        return; // keep dialog open so user can type confirm
      }
      if (code === 'RESET_IN_PROGRESS') {
        toast.error('Đang có người khác xóa, chờ vài giây');
        return;
      }
      toast.error(err?.message || 'Xóa data thất bại');
    }
  };

  const titleText = isLive
    ? `⛔ Race "${raceTitle}" đang LIVE — xóa data course ${courseName}?`
    : `Xóa dữ liệu course ${courseName}?`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className={isLive ? 'text-rose-600' : undefined}>
            {titleText}
          </AlertDialogTitle>
          <AlertDialogDescription>
            🗑️ Sẽ xóa {(stats?.rowCount ?? 0).toLocaleString('vi-VN')} kết quả
            của course {courseName} (race &ldquo;{raceTitle}&rdquo;).
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Structural content outside Description to avoid invalid <div>/<p> nesting (Next.js 16) */}
        <div className="space-y-3 text-sm">
          {hasApiUrl && stats?.cronStatus === 'scheduled' && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="mb-2 font-medium">
                ⚠️ Course này còn auto-sync từ vendor RaceResult.com.
              </p>
              <p className="text-xs">
                Cron sẽ tự đồng bộ lại vào{' '}
                <strong>{formatHHmmUtcPlus7(stats?.nextCronAt ?? null)} UTC+7</strong>
                {minutesToNextCron !== null
                  ? ` (~${minutesToNextCron} phút nữa)`
                  : ''}
                .
              </p>
              <label className="mt-2 flex items-start gap-2">
                <Checkbox
                  checked={disableAutoSync}
                  onCheckedChange={(v) => setDisableAutoSync(v === true)}
                />
                <span>
                  <strong>Tắt auto-sync trước khi xóa</strong> (khuyến nghị)
                  <br />
                  {!disableAutoSync && (
                    <em className="text-rose-700">
                      → Nếu bỏ tick: data sẽ bị overwrite lại sau ~
                      {minutesToNextCron ?? '?'} phút.
                    </em>
                  )}
                </span>
              </label>
            </div>
          )}

          {isLive && (
            <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-900">
              <p className="mb-2 font-medium">
                ⛔ Race &ldquo;{raceTitle}&rdquo; đang LIVE. Xóa data sẽ ảnh hưởng public
                leaderboard NGAY.
              </p>
              <p className="mb-1 text-xs">
                Gõ <code className="rounded bg-white px-1 font-mono">{courseName}</code> vào ô bên dưới để xác nhận:
              </p>
              <Input
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder={courseName}
                autoFocus
                className={
                  typedConfirm && !typedConfirmMatches
                    ? 'border-rose-500 focus-visible:ring-rose-500'
                    : ''
                }
              />
              {typedConfirm && !typedConfirmMatches && (
                <p className="mt-1 text-xs text-rose-700">
                  Tên course không khớp
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Thao tác này không thể hoàn tác.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {isSubmitting ? 'Đang xóa...' : 'Xóa data'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ResetDataConfirmDialog;
