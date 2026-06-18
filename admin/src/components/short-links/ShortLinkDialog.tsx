'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateShortLink, useUpdateShortLink } from '@/lib/short-links-hooks';
import { ShortLinkApiError, type ShortLink } from '@/lib/short-links-api';

const URL_RE = /^https?:\/\/.+/i;
const ALIAS_RE = /^[A-Za-z0-9_-]{3,32}$/;

export function ShortLinkDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ShortLink | null;
}) {
  const createMut = useCreateShortLink();
  const updateMut = useUpdateShortLink();
  const isEdit = !!editing;

  const [targetUrl, setTargetUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customAlias, setCustomAlias] = useState('');

  useEffect(() => {
    if (open) {
      setTargetUrl(editing?.targetUrl ?? '');
      setTitle(editing?.title ?? '');
      setCustomAlias('');
    }
  }, [open, editing]);

  const urlValid = URL_RE.test(targetUrl.trim());
  const aliasValid = !customAlias || ALIAS_RE.test(customAlias.trim());
  const pending = createMut.isPending || updateMut.isPending;
  const canSubmit = urlValid && aliasValid && !pending;

  async function handleSubmit() {
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          body: { targetUrl: targetUrl.trim(), title: title.trim() || undefined },
        });
        toast.success('Đã lưu link');
      } else {
        const created = await createMut.mutateAsync({
          targetUrl: targetUrl.trim(),
          title: title.trim() || undefined,
          customAlias: customAlias.trim() || undefined,
        });
        try {
          await navigator.clipboard.writeText(created.shortUrl);
          toast.success('Đã tạo link & copy vào clipboard');
        } catch {
          toast.success('Đã tạo link');
        }
      }
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ShortLinkApiError ? err.message : 'Có lỗi, thử lại';
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa link rút gọn' : 'Tạo link rút gọn'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="targetUrl">URL đích</Label>
            <Input
              id="targetUrl"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://5bib.com/vi/events/..."
            />
            {targetUrl && !urlValid && (
              <p className="text-xs text-destructive">
                URL phải bắt đầu http:// hoặc https://
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Tiêu đề (tùy chọn)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd Lào Cai Marathon 2026"
            />
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="alias">Alias tùy chỉnh (tùy chọn)</Label>
              <Input
                id="alias"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                placeholder="laocai2026"
              />
              <p className="text-xs text-muted-foreground">
                Để trống = tự sinh mã ngẫu nhiên. 3–32 ký tự: chữ/số/_/-
              </p>
              {customAlias && !aliasValid && (
                <p className="text-xs text-destructive">
                  Alias chỉ gồm chữ/số/_/- (3–32 ký tự)
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? 'Đang lưu…' : isEdit ? 'Lưu' : 'Tạo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
