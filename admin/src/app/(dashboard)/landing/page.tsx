'use client';

import { useState } from 'react';
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
import { useDeleteLanding, useLandings } from '@/lib/landing-hooks';
import { useCreateLanding } from '@/lib/landing-hooks';
import { LANDING_STATUS_LABEL } from '@/lib/landing-labels';
import { LandingApiError } from '@/lib/landing-api';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  published: 'default',
  draft: 'secondary',
  unpublished: 'outline',
};

export default function LandingListPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useLandings({ pageSize: 50 });
  const createMut = useCreateLanding();
  const deleteMut = useDeleteLanding();

  const [open, setOpen] = useState(false);
  const [raceId, setRaceId] = useState('');
  const [delId, setDelId] = useState<{ id: string; name?: string } | null>(null);

  async function handleCreate() {
    try {
      const landing = await createMut.mutateAsync(raceId.trim());
      setOpen(false);
      setRaceId('');
      router.push(`/landing/${landing.id}/builder`);
    } catch (err) {
      const msg = err instanceof LandingApiError ? err.message : 'Tạo trang thất bại';
      toast.error(msg);
    }
  }

  async function handleDelete() {
    if (!delId) return;
    try {
      await deleteMut.mutateAsync(delId.id);
      toast.success('Đã xoá trang');
    } catch {
      toast.error('Xoá thất bại');
    } finally {
      setDelId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trang giải chạy</h1>
          <p className="text-sm text-muted-foreground">
            Landing page quảng bá riêng cho từng giải chạy.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Tạo trang mới</Button>
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
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">Chưa có trang nào.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Tạo trang đầu tiên
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên giải</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">Section bật</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.raceTitle ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.subdomain ? `${row.subdomain}.5bib.com` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                      {LANDING_STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{row.enabledSectionCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/landing/${row.id}/builder`)}
                    >
                      Sửa
                    </Button>
                    {row.subdomain && row.status === 'published' && (
                      <a
                        href={`https://${row.subdomain}.5bib.com`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline-offset-2 hover:underline"
                      >
                        Mở
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDelId({ id: row.id, name: row.raceTitle })}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo trang giải chạy</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="raceId">Race ID (Mongo _id của giải)</Label>
            <Input
              id="raceId"
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              placeholder="vd 6651a0f3..."
            />
            <p className="text-xs text-muted-foreground">
              Hệ thống tự tạo section + theme từ dữ liệu giải. (Picker tìm giải — bản sau.)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleCreate} disabled={!raceId.trim() || createMut.isPending}>
              {createMut.isPending ? 'Đang tạo…' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá trang “{delId?.name ?? ''}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Trang sẽ bị gỡ khỏi public. Hành động này có thể hoàn tác bằng cách tạo lại.
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
