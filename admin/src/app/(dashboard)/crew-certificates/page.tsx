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
import { useCrewBatches, useCreateBatch, useDeleteBatch } from '@/lib/crew-cert-hooks';
import { CrewCertApiError, type CrewBatchListItem } from '@/lib/crew-cert-api';

export default function CrewCertificatesPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useCrewBatches();
  const createMut = useCreateBatch();
  const deleteMut = useDeleteBatch();

  const [open, setOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [slug, setSlug] = useState('');
  const [del, setDel] = useState<CrewBatchListItem | null>(null);

  const slugValid = /^[a-z0-9-]{3,60}$/.test(slug);

  async function handleCreate() {
    try {
      const batch = await createMut.mutateAsync({ eventName: eventName.trim(), slug: slug.trim() });
      setOpen(false);
      setEventName('');
      setSlug('');
      router.push(`/crew-certificates/${batch.id}`);
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Tạo đợt thất bại');
    }
  }

  async function handleDelete() {
    if (!del) return;
    try {
      await deleteMut.mutateAsync(del.id);
      toast.success('Đã xoá đợt GCN');
    } catch {
      toast.error('Xoá thất bại');
    } finally {
      setDel(null);
    }
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Giấy chứng nhận Crew</h1>
          <p className="text-sm text-muted-foreground">
            Upload phôi + danh sách crew → crew tự tìm theo tên & tải GCN.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Tạo đợt</Button>
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
            <p className="text-sm text-muted-foreground">Chưa có đợt GCN nào.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Tạo đợt đầu tiên
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên sự kiện</TableHead>
                <TableHead>Link công khai</TableHead>
                <TableHead className="text-center">Số crew</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.eventName}</TableCell>
                  <TableCell className="font-mono text-xs">/gcn/{b.slug}</TableCell>
                  <TableCell className="text-center">{b.recipientCount}</TableCell>
                  <TableCell>
                    <Badge variant={b.active ? 'default' : 'secondary'}>
                      {b.active ? 'Đang bật' : 'Đã tắt'}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/crew-certificates/${b.id}`)}>
                      Mở
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDel(b)}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo đợt GCN</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="eventName">Tên sự kiện</Label>
              <Input id="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Crew Lào Cai Marathon 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Đường dẫn công khai</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="crew-lao-cai-2026" />
              <p className="text-xs text-muted-foreground">/gcn/&lt;slug&gt; — a-z, 0-9, dấu gạch ngang (3–60)</p>
              {slug && !slugValid && <p className="text-xs text-destructive">Slug không hợp lệ</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={handleCreate} disabled={!eventName.trim() || !slugValid || createMut.isPending}>
              {createMut.isPending ? 'Đang tạo…' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đợt “{del?.eventName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ danh sách crew + phôi của đợt này sẽ bị xoá. Không thể hoàn tác.
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
