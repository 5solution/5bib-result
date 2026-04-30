'use client';

/**
 * Chip Verification Admin Dashboard
 *
 * URL: /races/{mongoRaceId}/chip-mappings (Mongo Race._id from admin convention).
 *
 * 5bib-result Mongo Race và 5bib_platform_live MySQL race là 2 hệ thống tách
 * biệt — KHÔNG có mapping tự động. BTC phải nhập tay `mysql_race_id` lần đầu
 * để link race admin sang race platform. Sau khi link, mọi chip operation
 * dùng `mysql_race_id` từ `chip_race_configs` doc.
 *
 * Page có 2 phase:
 *   1. UNLINKED — chưa có config với mongo_race_id này → render LinkForm
 *   2. LINKED   — có config → render full UI (Stats / TokenPanel / CSVImport / Table / CacheStatus)
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getChipConfigByMongoId,
  linkMongoToMysql,
} from '@/lib/chip-verification-api';
import { ChipMappingStats } from './components/ChipMappingStats';
import { ChipVerifyTokenPanel } from './components/ChipVerifyTokenPanel';
import { CSVImportSection } from './components/CSVImportSection';
import { ChipMappingTable } from './components/ChipMappingTable';
import { CacheStatusPanel } from './components/CacheStatusPanel';

export default function ChipMappingsPage() {
  const params = useParams();
  const mongoRaceIdRaw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const mongoRaceId = String(mongoRaceIdRaw ?? '');
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const link = useQuery({
    queryKey: ['chip-config-by-mongo', mongoRaceId],
    queryFn: () => getChipConfigByMongoId(mongoRaceId),
    enabled: Boolean(mongoRaceId) && isAuthenticated,
    staleTime: 5_000,
  });

  if (authLoading || link.isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="m-6">
        <CardContent className="p-6">
          <p>Bạn cần đăng nhập admin để xem trang này.</p>
        </CardContent>
      </Card>
    );
  }

  if (!mongoRaceId || mongoRaceId.length < 8) {
    return (
      <Card className="m-6">
        <CardContent className="p-6">
          <p className="text-red-600">Race ID không hợp lệ.</p>
          <Link href="/races" className="mt-2 inline-block text-blue-600 underline">
            ← Quay về danh sách race
          </Link>
        </CardContent>
      </Card>
    );
  }

  const isLinked = link.data !== null && link.data !== undefined;
  const mysqlRaceId = link.data?.mysql_race_id ?? null;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/races/${mongoRaceId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Quay về race detail
          </Link>
          <h1 className="text-2xl font-bold sm:text-3xl">Chip Verification</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý mapping chip ↔ BIB cho racekit checkin Bàn 2.
            {mysqlRaceId !== null && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-800">
                MySQL race_id = {mysqlRaceId}
              </span>
            )}
          </p>
        </div>
      </header>

      {!isLinked ? (
        <LinkRaceForm mongoRaceId={mongoRaceId} />
      ) : (
        <LinkedView mongoRaceId={mongoRaceId} mysqlRaceId={mysqlRaceId!} />
      )}
    </div>
  );
}

// ─────────── PHASE 1: Link form ───────────

function LinkRaceForm({ mongoRaceId }: { mongoRaceId: string }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState<string>('');
  const link = useMutation({
    mutationFn: (mysqlRaceId: number) =>
      linkMongoToMysql(mongoRaceId, mysqlRaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chip-config-by-mongo', mongoRaceId],
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(input.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('mysql_race_id phải là số nguyên dương');
      return;
    }
    link.mutate(parsed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link race admin sang MySQL platform</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Race admin (Mongo) và race trên platform 5bib_platform_live (MySQL)
          là <strong>2 hệ thống tách biệt</strong>. Nhập tay{' '}
          <code className="font-mono">mysql_race_id</code> (số nguyên) từ
          platform để link 2 hệ thống cho race này.
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="mysql-race-id">
              MySQL race_id (lấy từ 5bib_platform_live.races.race_id)
            </Label>
            <Input
              id="mysql-race-id"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="VD: 123"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="max-w-xs font-mono"
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Race admin Mongo ID:{' '}
              <code className="font-mono">{mongoRaceId}</code>
            </p>
          </div>

          {link.isError && (
            <p className="text-sm text-red-600">
              {(link.error as Error).message}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={link.isPending || !input.trim()}>
              {link.isPending ? 'Đang link...' : 'Link race'}
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground">
          Sau khi link, có thể đổi <code>mysql_race_id</code> chỉ khi chưa có
          chip mapping nào (tránh mất data).
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────── PHASE 2: Linked view (full UI) ───────────

function LinkedView({
  mongoRaceId,
  mysqlRaceId,
}: {
  mongoRaceId: string;
  mysqlRaceId: number;
}) {
  return (
    <>
      <ChipMappingStats raceId={mysqlRaceId} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChipVerifyTokenPanel raceId={mysqlRaceId} />
        <CacheStatusPanel raceId={mysqlRaceId} />
      </div>
      <CSVImportSection raceId={mysqlRaceId} />
      <ChipMappingTable raceId={mysqlRaceId} />
      <p className="text-xs text-muted-foreground">
        Mongo race: <code className="font-mono">{mongoRaceId}</code> · MySQL
        race_id: <code className="font-mono">{mysqlRaceId}</code>
      </p>
    </>
  );
}
