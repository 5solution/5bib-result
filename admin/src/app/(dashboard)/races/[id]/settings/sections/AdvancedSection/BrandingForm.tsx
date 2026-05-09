'use client';

/**
 * F-014 — Branding form (logo / image / banner / brand color / sponsor banners).
 *
 * Verbatim port of legacy `Branding` tab (lines 1283–1389). 5 image
 * upload composites + brand color picker + sponsor banners + Save.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Save } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import SponsorBanners from '@/components/SponsorBanners';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { racesControllerUpdateRace } from '@/lib/api-generated';
import type { EditForm } from '../section-shared.types';

interface BrandingFormProps {
  raceId: string;
  editForm: EditForm;
  onEditFormChange: (next: EditForm) => void;
  onRefetch: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function BrandingForm(props: BrandingFormProps) {
  const { raceId, editForm, onEditFormChange, onRefetch, onDirtyChange } = props;
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<EditForm>) => {
    onEditFormChange({ ...editForm, ...patch });
    onDirtyChange?.(true);
  };

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const { error } = await racesControllerUpdateRace({
        path: { id: raceId },
        body: {
          ...editForm,
          cacheTtlSeconds: editForm.cacheTtlSeconds ?? 60,
        } as unknown as Parameters<typeof racesControllerUpdateRace>[0]['body'],
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success('Cập nhật giải thành công!');
      onDirtyChange?.(false);
      onRefetch();
    } catch {
      toast.error('Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hình ảnh & Thương hiệu</CardTitle>
        <CardDescription>Logo, banner, ảnh đại diện và nhà tài trợ</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Logo giải</Label>
            <ImageUpload
              value={editForm.logoUrl}
              onChange={(url) => update({ logoUrl: url })}
              folder={`races/${raceId}/logos`}
              token={token || undefined}
              label="Tải logo"
              previewHeight="h-24"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Ảnh đại diện</Label>
            <ImageUpload
              value={editForm.imageUrl}
              onChange={(url) => update({ imageUrl: url })}
              folder={`races/${raceId}/images`}
              token={token || undefined}
              label="Tải ảnh đại diện"
              previewHeight="h-32"
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Banner (ảnh bìa trang giải)</Label>
            <ImageUpload
              value={editForm.bannerUrl}
              onChange={(url) => update({ bannerUrl: url })}
              folder={`races/${raceId}/banners`}
              token={token || undefined}
              label="Tải banner"
              previewHeight="h-40"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Màu thương hiệu</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editForm.brandColor || '#2563EB'}
                onChange={(e) => update({ brandColor: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded border bg-transparent"
              />
              <Input
                value={editForm.brandColor ?? ''}
                onChange={(e) => update({ brandColor: e.target.value })}
                placeholder="#2563EB"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label>Banner nhà tài trợ</Label>
          <p className="text-xs text-muted-foreground">
            Thêm logo/banner các nhà tài trợ hiển thị ở trang kết quả
          </p>
          <SponsorBanners
            value={editForm.sponsorBanners || []}
            onChange={(urls) => update({ sponsorBanners: urls })}
            folder={`races/${raceId}/sponsors`}
            token={token || undefined}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu thương hiệu'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default BrandingForm;
