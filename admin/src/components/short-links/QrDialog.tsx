'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shortLinkQrUrl, type ShortLink } from '@/lib/short-links-api';

export function QrDialog({
  link,
  onClose,
}: {
  link: ShortLink | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>QR — {link?.code}</DialogTitle>
        </DialogHeader>
        {link && (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shortLinkQrUrl(link.id)}
              alt={`QR ${link.code}`}
              width={256}
              height={256}
              className="rounded border"
            />
            <p className="font-mono text-xs text-muted-foreground">{link.shortUrl}</p>
          </div>
        )}
        <DialogFooter>
          {link && (
            <a href={shortLinkQrUrl(link.id)} download={`qr-${link.code}.png`}>
              <Button>Tải PNG</Button>
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
