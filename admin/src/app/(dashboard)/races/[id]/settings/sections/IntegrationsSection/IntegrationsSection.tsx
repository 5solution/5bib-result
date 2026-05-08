'use client';

/**
 * F-014 BR-AS-39/40 — Integrations section.
 *
 * Hosts the cacheTtlSeconds field (moved from Race Meta per BR-AS-39 —
 * operational/integrations in nature, not race identity).
 *
 * Cross-link card to Course section anchor (BR-AS-40) — the per-course
 * Force-sync / Reset-data actions stay inline in CourseTable to avoid
 * double truth, but admins arriving here should know where to find them.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
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
import { ArrowRight, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { racesControllerUpdateRace } from '@/lib/api-generated';
import type { EditForm } from '../section-shared.types';

interface IntegrationsSectionProps {
  raceId: string;
  editForm: EditForm;
  onEditFormChange: (next: EditForm) => void;
  onRefetch: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function IntegrationsSection(props: IntegrationsSectionProps) {
  const { raceId, editForm, onEditFormChange, onRefetch, onDirtyChange } = props;
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

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
      toast.success('Cập nhật tích hợp thành công!');
      onDirtyChange?.(false);
      onRefetch();
    } catch {
      toast.error('Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="integrations"
      className="scroll-mt-24"
      aria-labelledby="integrations-heading"
    >
      <Card>
        <CardHeader>
          <CardTitle id="integrations-heading">Tích hợp</CardTitle>
          <CardDescription>
            Cấu hình cache Redis và liên kết tới các thao tác đồng bộ per-course
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-ttl">Thời gian cache (giây)</Label>
              <Input
                id="edit-ttl"
                type="number"
                value={editForm.cacheTtlSeconds ?? 60}
                onChange={(e) => {
                  onEditFormChange({
                    ...editForm,
                    cacheTtlSeconds: parseInt(e.target.value) || 60,
                  });
                  onDirtyChange?.(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Redis TTL cho race data cache. Thay đổi sẽ áp dụng cho lần sync tiếp theo.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4 mr-2" />
              {saving ? 'Đang lưu...' : 'Lưu tích hợp'}
            </Button>
          </div>

          {/* Cross-link to course-table sync actions (BR-AS-40) */}
          <div className="rounded-lg border border-dashed bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="size-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Force sync / Reset data per cự ly</p>
                <p className="text-xs text-muted-foreground">
                  Các thao tác đồng bộ và xóa dữ liệu được nhúng inline ở bảng cự ly
                  để tránh "double truth". Đi tới mục Cự ly để dùng.
                </p>
              </div>
              <Link href="#course">
                <Button variant="outline" size="sm">
                  Mở Cự ly
                  <ArrowRight className="size-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default IntegrationsSection;
