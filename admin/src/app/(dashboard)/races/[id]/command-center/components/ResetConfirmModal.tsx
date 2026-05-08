'use client';

/**
 * F-008 v2 BR-CC2-14 — Reset 2-step confirmation modal (race-day safety).
 *
 * Risk: a misclick on Reset wipes alerts/polls/race_results for the race —
 * destructive on race day. Mitigation: 2 steps.
 *   Step 1 — warning copy + Cancel/Continue
 *   Step 2 — typing the race title (or slug) exactly to enable submit
 *
 * Backend already enforces (`POST /api/admin/races/:raceId/timing-alert/reset`):
 *   - LogtoAdminGuard
 *   - body.confirmToken === race.slug (rejected otherwise)
 *   - throws if race.status === 'live' | 'ended' (production lock)
 *
 * Surface the backend's `live`/`ended` lock as inline error toast — the
 * trigger button itself is also disabled when raceStatus is live/ended so
 * race-day MC cannot even open the dialog.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  HttpError,
  resetRaceData,
  type ResetRaceDataResponse,
} from '@/lib/timing-alert-api';

interface ResetConfirmModalProps {
  raceId: string;
  raceTitle: string;
  /** Race slug — backend requires `confirmToken === race.slug`. */
  raceSlug: string;
  /** Race status — used to disable trigger button on live/ended. */
  raceStatus: 'draft' | 'pre_race' | 'live' | 'ended';
}

export function ResetConfirmModal({
  raceId,
  raceTitle,
  raceSlug,
  raceStatus,
}: ResetConfirmModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [includeRaceResults, setIncludeRaceResults] = useState(false);

  const matches = typed.trim() === raceSlug.trim();
  const blockedByStatus = raceStatus === 'live' || raceStatus === 'ended';

  const resetMutation = useMutation<ResetRaceDataResponse, unknown>({
    mutationFn: () => resetRaceData(raceId, includeRaceResults, raceSlug),
    onSuccess: (data) => {
      toast.success(
        `Đã reset: ${data.alertsDeleted} alerts, ${data.pollsDeleted} polls, ${data.raceResultsDeleted} results`,
      );
      handleClose();
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        if (err.status === 409 || err.status === 400) {
          toast.error(err.message || 'Race đang live — không thể reset');
          return;
        }
      }
      toast.error(
        err instanceof Error ? err.message : 'Reset thất bại',
      );
    },
  });

  const handleClose = () => {
    setOpen(false);
    // Reset internal state on close so re-open starts at Step 1
    setTimeout(() => {
      setStep(1);
      setTyped('');
      setIncludeRaceResults(false);
    }, 200);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        disabled={blockedByStatus}
        className="h-9 gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        title={
          blockedByStatus
            ? 'Reset bị khoá khi race đang live/ended (race-day safety)'
            : 'Reset alerts + poll logs cho race này'
        }
        data-testid="reset-trigger-button"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Reset</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
          else setOpen(o);
        }}
      >
        <DialogContent
          className="sm:max-w-[520px]"
          data-testid="reset-confirm-modal"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              {step === 1
                ? 'Reset dữ liệu race?'
                : 'Xác nhận lần cuối — gõ tên race'}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? 'Hành động này KHÔNG hoàn tác được. Mọi alerts đã resolve + poll logs sẽ bị xoá vĩnh viễn.'
                : `Để tránh nhầm lẫn, gõ chính xác slug race "${raceSlug}" để bật nút Reset.`}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-semibold">Sẽ xoá:</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  <li>Tất cả timing alerts (OPEN + RESOLVED + FALSE_ALARM)</li>
                  <li>Tất cả poll logs</li>
                  <li>Redis cache snapshot + leaderboard</li>
                  {includeRaceResults && (
                    <li>
                      <strong>Race results MongoDB</strong> (đặt lại sync từ
                      đầu)
                    </li>
                  )}
                </ul>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <Checkbox
                  checked={includeRaceResults}
                  onCheckedChange={(v) =>
                    setIncludeRaceResults(v === true)
                  }
                />
                <span>
                  Xoá luôn race_results MongoDB (cần re-sync RaceResultCron)
                </span>
              </label>
              <div className="text-xs text-stone-500">
                Race: <strong>{raceTitle}</strong>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={raceSlug}
                autoFocus
                data-testid="reset-typing-input"
              />
              {typed.length > 0 && !matches && (
                <p className="text-xs text-rose-600">
                  Không khớp slug. Cần gõ chính xác:{' '}
                  <code className="rounded bg-stone-100 px-1">{raceSlug}</code>
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={resetMutation.isPending}
            >
              Huỷ
            </Button>
            {step === 1 ? (
              <Button
                type="button"
                variant="default"
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => setStep(2)}
              >
                Tiếp tục →
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={!matches || resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
                data-testid="reset-confirm-submit"
              >
                {resetMutation.isPending ? 'Đang reset…' : 'Xác nhận Reset'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
