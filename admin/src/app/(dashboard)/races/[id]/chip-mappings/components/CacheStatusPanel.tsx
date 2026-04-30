'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import {
  chipCacheAction,
  getChipConfig,
  setDeltaSyncEnabled,
} from '@/lib/chip-verification-api';

interface Props {
  raceId: number;
}

export function CacheStatusPanel({ raceId }: Props) {
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);

  const config = useQuery({
    queryKey: ['chip-config', raceId],
    queryFn: () => getChipConfig(raceId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const cache = useMutation({
    mutationFn: (action: 'REFRESH' | 'CLEAR') =>
      chipCacheAction(raceId, action),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['chip-config', raceId] });
      queryClient.invalidateQueries({ queryKey: ['chip-stats', raceId] });
      if (action === 'CLEAR') setConfirmClear(false);
    },
  });

  const deltaSync = useMutation({
    mutationFn: (enabled: boolean) => setDeltaSyncEnabled(raceId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chip-config', raceId] });
    },
  });

  const cacheReady = config.data?.cache_ready ?? false;
  const preloadAt = config.data?.preload_completed_at ?? null;
  const totalMappings = config.data?.total_chip_mappings ?? 0;
  const enabled = config.data?.chip_verify_enabled ?? false;
  const deltaSyncEnabled = config.data?.delta_sync_enabled ?? true;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Redis cache</span>
            {cacheReady ? (
              <Badge className="bg-green-600">Ready</Badge>
            ) : (
              <Badge variant="outline">Not loaded</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Cached mappings</p>
              <p className="font-semibold">
                {totalMappings.toLocaleString('vi-VN')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last preload</p>
              <p className="font-semibold">
                {preloadAt
                  ? new Date(preloadAt).toLocaleString('vi-VN')
                  : '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => cache.mutate('REFRESH')}
              disabled={cache.isPending || !enabled}
              title={!enabled ? 'Phải GENERATE token trước' : undefined}
            >
              {cache.isPending && cache.variables === 'REFRESH'
                ? 'Refreshing...'
                : '🔄 Refresh cache'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmClear(true)}
              disabled={cache.isPending || !cacheReady}
            >
              Clear cache
            </Button>
          </div>

          {cache.isError && (
            <p className="text-sm text-red-600">
              {(cache.error as Error).message}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Refresh = full preload từ MySQL. Clear = xóa cache (kiosk sẽ chậm 1-2s
            cho lần lookup đầu của mỗi chip cho đến khi cache rebuild).
          </p>

          {/* Auto cron delta sync toggle */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <Label
                  htmlFor={`delta-sync-${raceId}`}
                  className="text-sm font-semibold"
                >
                  Auto sync mỗi 30s
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tự pull data athletes mới từ MySQL → cache mỗi 30 giây.
                  Tắt khi muốn freeze cache hoặc giảm load MySQL race day.
                </p>
              </div>
              <Switch
                id={`delta-sync-${raceId}`}
                checked={deltaSyncEnabled}
                onCheckedChange={(v) => deltaSync.mutate(v)}
                disabled={deltaSync.isPending || !enabled}
              />
            </div>
            {!deltaSyncEnabled && enabled && (
              <p className="mt-2 text-xs text-amber-700">
                ⚠️ Cron đang TẮT — cache không tự update khi BTC gán BIB mới.
                Athletes mới chỉ thấy qua on-demand fallback (chậm hơn 100-300ms
                lần đầu).
              </p>
            )}
            {deltaSync.isError && (
              <p className="mt-2 text-xs text-red-600">
                {(deltaSync.error as Error).message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Redis cache?</AlertDialogTitle>
            <AlertDialogDescription>
              Sẽ xóa toàn bộ athlete cache cho race này. Kiosk lookup sẽ chậm
              1-2s/chip cho đến khi on-demand fallback build cache lại. Race day
              KHÔNG nên clear — chỉ dùng khi data lỗi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cache.mutate('CLEAR')}
              disabled={cache.isPending}
            >
              {cache.isPending ? 'Clearing...' : 'Clear cache'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
