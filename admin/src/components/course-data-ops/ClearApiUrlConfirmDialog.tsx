'use client';

/**
 * F-068 Clear apiUrl confirmation dialog.
 *
 * Standalone destructive action — disables auto-sync but does NOT delete row
 * data. Race=live still requires typed confirmation (Danny chốt #2). On error
 * 409 RACE_IS_LIVE_CONFIRM_REQUIRED the toast nudges admin to re-confirm
 * (Danny chốt D).
 */
import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';

import type { CourseDataStatsDto } from '@/lib/course-data-ops-api';
import { useClearCourseApiUrl } from '@/lib/course-data-ops-hooks';

import type { RaceLiveStatus } from './ResetDataConfirmDialog';

export interface ClearApiUrlConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raceId: string;
  raceTitle: string;
  raceStatus: RaceLiveStatus;
  courseId: string;
  courseName: string;
  stats: CourseDataStatsDto | undefined;
}

export function ClearApiUrlConfirmDialog(props: ClearApiUrlConfirmDialogProps) {
  const {
    open,
    onOpenChange,
    raceId,
    raceTitle,
    raceStatus,
    courseId,
    courseName,
    stats,
  } = props;

  const isLive = raceStatus === 'live';
  const [typedConfirm, setTypedConfirm] = useState<string>('');

  useEffect(() => {
    if (open) setTypedConfirm('');
  }, [open, courseId]);

  const clearMut = useClearCourseApiUrl(raceId, courseId);
  const isSubmitting = clearMut.isPending;
  const typedConfirmMatches = !isLive || typedConfirm === courseName;
  const canConfirm = !isSubmitting && typedConfirmMatches;

  const handleConfirm = async () => {
    try {
      await clearMut.mutateAsync({
        confirmedLive: isLive ? true : undefined,
      });
      toast.success(
        `Đã tắt auto-sync course ${courseName}. Vendor RaceResult sẽ không còn ghi đè.`,
      );
      onOpenChange(false);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'RACE_IS_LIVE_CONFIRM_REQUIRED') {
        toast.error('Race vừa chuyển LIVE, vui lòng xác nhận lại');
        return;
      }
      toast.error(err?.message || 'Tắt auto-sync thất bại');
    }
  };

  const titleText = isLive
    ? `⛔ Race "${raceTitle}" đang LIVE — tắt auto-sync course ${courseName}?`
    : `Tắt auto-sync course ${courseName}?`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className={isLive ? 'text-rose-600' : undefined}>
            {titleText}
          </AlertDialogTitle>
          <AlertDialogDescription>
            🔌 Vendor RaceResult.com sẽ KHÔNG còn tự động sync kết quả vào course này nữa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Structural content outside Description to avoid invalid <div>/<p> nesting (Next.js 16) */}
        <div className="space-y-3 text-sm">
          {stats?.apiUrlMasked && (
            <div className="rounded border border-muted bg-muted/40 p-2 font-mono text-xs">
              {stats.apiUrlMasked}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Data hiện có ({(stats?.rowCount ?? 0).toLocaleString('vi-VN')} kết quả) sẽ KHÔNG bị xóa. Để xóa luôn data, dùng nút &ldquo;Xóa dữ liệu&rdquo; với checkbox &ldquo;Tắt auto-sync trước&rdquo;.
          </p>

          {isLive && (
            <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-900">
              <p className="mb-2 font-medium">
                ⛔ Race &ldquo;{raceTitle}&rdquo; đang LIVE. Tắt auto-sync sẽ ngừng live timing.
              </p>
              <p className="mb-1 text-xs">
                Gõ <code className="rounded bg-white px-1 font-mono">{courseName}</code> để xác nhận:
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
            {isSubmitting ? 'Đang tắt...' : 'Tắt auto-sync'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ClearApiUrlConfirmDialog;
