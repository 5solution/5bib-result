'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { chipTokenAction, getChipConfig } from '@/lib/chip-verification-api';

interface Props {
  raceId: number;
}

type DialogMode = 'rotate' | 'disable' | null;

export function ChipVerifyTokenPanel({ raceId }: Props) {
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<DialogMode>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const config = useQuery({
    queryKey: ['chip-config', raceId],
    queryFn: () => getChipConfig(raceId),
    staleTime: 5_000,
  });

  const action = useMutation({
    mutationFn: (act: 'GENERATE' | 'ROTATE' | 'DISABLE') =>
      chipTokenAction(raceId, act),
    onSuccess: (data, act) => {
      queryClient.invalidateQueries({ queryKey: ['chip-config', raceId] });
      queryClient.invalidateQueries({ queryKey: ['chip-stats', raceId] });
      if ((act === 'GENERATE' || act === 'ROTATE') && data.token) {
        setRevealedToken(data.token);
      } else {
        setRevealedToken(null);
      }
      setConfirmDialog(null);
    },
  });

  // BUG #FE-2 fix — use explicit env var, NOT origin substring replace.
  // The naïve `.replace('admin', 'result')` produced "result-result.5bib.com"
  // for prod admin URL "result-admin.5bib.com" — kiosk URL would 404.
  //
  // NEXT_PUBLIC_RESULT_BASE_URL set at build time:
  //   - production: https://result.5bib.com
  //   - dev:        https://result-fe-dev.5bib.com
  // Falls back to inferring from current origin (admin → frontend host) for
  // local docker-compose where env may be unset.
  const kioskUrl = revealedToken ? buildKioskUrl(revealedToken) : null;

  const copyUrl = async () => {
    if (!kioskUrl) return;
    await navigator.clipboard.writeText(kioskUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (config.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify token</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const enabled = config.data?.chip_verify_enabled ?? false;
  const totalMappings = config.data?.total_chip_mappings ?? 0;
  const cacheReady = config.data?.cache_ready ?? false;
  const canEnable = totalMappings > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Verify token & kiosk URL</span>
            {enabled ? (
              <Badge className="bg-green-600">Enabled</Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enabled && !canEnable && (
            <p className="text-sm text-muted-foreground">
              Cần import ít nhất 1 mapping chip↔BIB trước khi enable token.
            </p>
          )}

          {revealedToken && kioskUrl && (
            <div className="rounded-md border border-green-300 bg-green-50 p-3">
              <p className="text-xs font-semibold uppercase text-green-800">
                Kiosk URL — copy NGAY (chỉ hiện 1 lần)
              </p>
              <p className="mt-1 break-all font-mono text-xs">{kioskUrl}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={copyUrl}>
                  {copied ? '✓ Copied' : 'Copy URL'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRevealedToken(null)}
                >
                  Đã lưu, đóng
                </Button>
              </div>
              <p className="mt-2 text-xs text-amber-700">
                ⚠️ KHÔNG share URL công khai — bất kỳ ai có URL đều quẹt được.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!enabled && (
              <Button
                onClick={() => action.mutate('GENERATE')}
                disabled={!canEnable || action.isPending}
              >
                {action.isPending && action.variables === 'GENERATE'
                  ? 'Generating...'
                  : 'GENERATE token'}
              </Button>
            )}
            {enabled && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDialog('rotate')}
                  disabled={action.isPending}
                >
                  ROTATE
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDialog('disable')}
                  disabled={action.isPending}
                >
                  DISABLE
                </Button>
              </>
            )}
          </div>

          {action.isError && (
            <p className="text-sm text-red-600">
              {(action.error as Error).message}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Total mappings</p>
              <p className="font-semibold">{totalMappings.toLocaleString('vi-VN')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cache ready</p>
              <p className="font-semibold">
                {cacheReady ? '✅ Ready' : '⚠️ Not loaded'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={confirmDialog !== null}
        onOpenChange={(o) => !o && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog === 'rotate'
                ? 'Confirm ROTATE token'
                : 'Confirm DISABLE verify'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog === 'rotate' ? (
                <>
                  Token cũ sẽ <strong>vô hiệu ngay lập tức</strong>. Tất cả kiosk
                  Bàn 2 sẽ mất kết nối — cần share URL mới cho NV trạm. Tiếp tục?
                </>
              ) : (
                <>
                  Tất cả kiosk Bàn 2 sẽ <strong>mất kết nối ngay lập tức</strong>.
                  Cache sẽ clear, lần enable sau cần preload lại. Tiếp tục?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog === 'disable' ? 'destructive' : 'default'}
              onClick={() =>
                action.mutate(
                  confirmDialog === 'rotate' ? 'ROTATE' : 'DISABLE',
                )
              }
              disabled={action.isPending}
            >
              {action.isPending
                ? 'Processing...'
                : confirmDialog === 'rotate'
                  ? 'Rotate token'
                  : 'Disable verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Build the public kiosk URL for a freshly-issued token.
 *
 * Priority order:
 *   1. NEXT_PUBLIC_RESULT_BASE_URL env (set at admin build time per env)
 *   2. Heuristic rewrite of current admin origin → public frontend host:
 *        result-admin-dev.5bib.com → result-fe-dev.5bib.com
 *        result-admin.5bib.com     → result.5bib.com
 *   3. SSR safety: empty origin (component is 'use client' so this only hits
 *      during the Server Component pre-render which discards revealedToken).
 */
function buildKioskUrl(token: string): string {
  const envBase = process.env.NEXT_PUBLIC_RESULT_BASE_URL;
  if (envBase) {
    return `${envBase.replace(/\/$/, '')}/chip-verify/${token}`;
  }
  if (typeof window === 'undefined') return `/chip-verify/${token}`;

  const origin = window.location.origin;
  // Map admin host → public frontend host (kiosk runs on frontend).
  // Cover các pattern actual deploy đã thấy:
  //   result-admin-dev.5bib.com  → result-fe-dev.5bib.com  (CLAUDE.md spec)
  //   admin-dev.5bib.com         → result-fe-dev.5bib.com  (actual VPS DEV)
  //   result-admin.5bib.com      → result.5bib.com         (production)
  //   admin.5bib.com             → result.5bib.com         (production alias)
  const mapped = origin
    .replace(/result-admin-dev\.5bib\.com/, 'result-fe-dev.5bib.com')
    .replace(/^https?:\/\/admin-dev\.5bib\.com/, (m) =>
      m.replace(/admin-dev\.5bib\.com/, 'result-fe-dev.5bib.com'),
    )
    .replace(/result-admin\.5bib\.com/, 'result.5bib.com')
    .replace(/^https?:\/\/admin\.5bib\.com/, (m) =>
      m.replace(/admin\.5bib\.com/, 'result.5bib.com'),
    );
  return `${mapped}/chip-verify/${token}`;
}
