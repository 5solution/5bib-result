'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  useBibPassConfigs,
  useBibPassRaceOptions,
  useDeleteBibPassConfig,
} from '@/lib/bib-pass-hooks';
import { BibPassApiError, type BibPassConfigListItem } from '@/lib/bib-pass-api';

export default function BibPassListPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useBibPassConfigs();
  const { data: raceData } = useBibPassRaceOptions();
  const deleteMut = useDeleteBibPassConfig();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [del, setDel] = useState<BibPassConfigListItem | null>(null);

  const rows = data?.items ?? [];
  const raceOptions = useMemo(() => {
    const all = raceData?.items ?? [];
    const q = search.trim().toLowerCase();
    return all
      .filter(
        (r) =>
          !q ||
          (r.title ?? '').toLowerCase().includes(q) ||
          String(r.raceId).includes(q),
      )
      .slice(0, 50);
  }, [raceData, search]);

  async function handleDelete() {
    if (!del) return;
    try {
      await deleteMut.mutateAsync(del.raceId);
      toast.success('Đã xoá cấu hình');
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Xoá thất bại');
    } finally {
      setDel(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Border Pass email</h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình ảnh Border Pass gửi qua email cho VĐV NGAY SAU khi họ xác nhận số BIB.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Cấu hình giải</Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Không tải được danh sách. Thử lại sau.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">Chưa cấu hình giải nào.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Cấu hình giải đầu tiên
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Giải</TableHead>
                <TableHead className="text-center">Phôi</TableHead>
                <TableHead className="text-center">Đã gửi</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.raceId}>
                  <TableCell className="font-medium">
                    {c.raceName || `Giải #${c.raceId}`}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">#{c.raceId}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.hasTemplate ? (
                      <Badge variant="default">Đã có</Badge>
                    ) : (
                      <Badge variant="secondary">Chưa</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono">{c.sentCount}</TableCell>
                  <TableCell>
                    <Badge variant={c.enabled ? 'default' : 'secondary'}>
                      {c.enabled ? 'Đang gửi' : 'Đang tắt'}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/bib-pass/${c.raceId}`)}>
                      Mở
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDel(c)}
                    >
                      Xoá
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chọn giải để cấu hình</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="race-search">Tìm giải (tên hoặc ID)</Label>
              <Input
                id="race-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vietnam Mountain Marathon…"
              />
              <p className="text-xs text-muted-foreground">
                Chỉ hiện giải có VĐV ĐÃ xác nhận số BIB.
              </p>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded border">
              {raceOptions.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Không có giải khớp.
                </p>
              ) : (
                raceOptions.map((r) => (
                  <button
                    key={r.raceId}
                    type="button"
                    onClick={() => router.push(`/bib-pass/${r.raceId}`)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {r.title || `Giải #${r.raceId}`}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        #{r.raceId} · {r.confirmedCount} VĐV đã xác nhận
                      </span>
                    </span>
                    {r.configured && <Badge variant="secondary">Đã cấu hình</Badge>}
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá cấu hình “{del?.raceName || `#${del?.raceId}`}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Phôi + cấu hình email của giải này sẽ bị xoá. Lịch sử đã gửi (chống gửi trùng) vẫn
              được giữ. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
