'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  useShortLinks,
  useUpdateShortLink,
  useDeleteShortLink,
} from '@/lib/short-links-hooks';
import { ShortLinkApiError, type ShortLink } from '@/lib/short-links-api';
import { ShortLinkDialog } from '@/components/short-links/ShortLinkDialog';
import { QrDialog } from '@/components/short-links/QrDialog';

export default function ShortLinksPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useShortLinks({ search, pageSize: 50 });
  const updateMut = useUpdateShortLink();
  const deleteMut = useDeleteShortLink();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShortLink | null>(null);
  const [qrLink, setQrLink] = useState<ShortLink | null>(null);
  const [delLink, setDelLink] = useState<ShortLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(link: ShortLink) {
    setEditing(link);
    setDialogOpen(true);
  }

  async function copy(link: ShortLink) {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Không copy được');
    }
  }

  async function toggleActive(link: ShortLink) {
    try {
      await updateMut.mutateAsync({ id: link.id, body: { active: !link.active } });
      toast.success(link.active ? 'Đã tắt link' : 'Đã bật link');
    } catch (err) {
      const msg = err instanceof ShortLinkApiError ? err.message : 'Thao tác thất bại';
      toast.error(msg);
    }
  }

  async function handleDelete() {
    if (!delLink) return;
    try {
      await deleteMut.mutateAsync(delLink.id);
      toast.success('Đã xoá link');
    } catch {
      toast.error('Xoá thất bại');
    } finally {
      setDelLink(null);
    }
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Link rút gọn</h1>
          <p className="text-sm text-muted-foreground">
            Rút gọn URL bất kỳ thành <span className="font-mono">s.5bib.com/…</span> để
            đăng MXH không bị lỗi.
          </p>
        </div>
        <Button onClick={openCreate}>+ Tạo link</Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo mã / tiêu đề / URL…"
        className="max-w-sm"
      />

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Không tải được danh sách. Thử lại sau.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? 'Không có link khớp tìm kiếm.' : 'Chưa có link nào.'}
            </p>
            {search ? (
              <Button variant="outline" onClick={() => setSearch('')}>
                Xoá tìm kiếm
              </Button>
            ) : (
              <Button variant="outline" onClick={openCreate}>
                + Tạo link
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Short link</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>URL đích</TableHead>
                <TableHead className="text-center">Click</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => copy(link)}
                      className="font-mono text-sm text-primary hover:underline"
                      title="Copy short link"
                    >
                      s.5bib.com/{link.code}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {copiedId === link.id ? '✓ đã copy' : '⧉'}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate" title={link.title}>
                    {link.title || '—'}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    <a
                      href={link.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                      title={link.targetUrl}
                    >
                      {link.targetUrl}
                    </a>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {link.clickCount.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={link.active ? 'default' : 'secondary'}>
                      {link.active ? 'Đang bật' : 'Đã tắt'}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button size="sm" variant="outline" onClick={() => setQrLink(link)}>
                      QR
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(link)}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(link)}>
                      {link.active ? 'Tắt' : 'Bật'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDelLink(link)}
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

      <ShortLinkDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <QrDialog link={qrLink} onClose={() => setQrLink(null)} />

      <AlertDialog open={!!delLink} onOpenChange={(o) => !o && setDelLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá link s.5bib.com/{delLink?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Link sẽ ngừng hoạt động ngay. Cân nhắc “Tắt” nếu chỉ muốn tạm ẩn.
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
