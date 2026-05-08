'use client';

/**
 * F-014 BR-AS-44 — Race Meta section (12 fields).
 *
 * Verbatim port of legacy `Info` tab (page.tsx lines 746–1135).
 * BR-AF-23 byte-for-byte preserve: same field keys, same validation,
 * same submit endpoint (`racesControllerUpdateRace`), same toast copy.
 *
 * Fields (per PAUSE-AS-02 audit rows #28–#48):
 *   - Status stepper + Override (rows 28–36)
 *   - title, slug, raceType, province, location, organizer, season (37–43)
 *   - startDate, endDate (45–46)
 *   - description (47, normalized to shadcn Textarea per BR-AS-43)
 *   - Save button (48)
 *
 * NOTE row #44 (cacheTtlSeconds) MOVED to IntegrationsSection per BR-AS-39.
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
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Save, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import {
  racesControllerUpdateRace,
  racesControllerUpdateStatus,
  racesControllerForceUpdateStatus,
} from '@/lib/api-generated';
import { useConfirm } from '@/components/confirm-dialog';
import { LifecycleStepper } from './LifecycleStepper';
import { OverrideStatusDialog } from './OverrideStatusDialog';
import type {
  EditForm,
  Race,
  RaceStatus,
} from '../section-shared.types';

interface RaceMetaSectionProps {
  raceId: string;
  race: Race;
  editForm: EditForm;
  onEditFormChange: (next: EditForm) => void;
  onRefetch: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function RaceMetaSection(props: RaceMetaSectionProps) {
  const { raceId, race, editForm, onEditFormChange, onRefetch, onDirtyChange } =
    props;
  const { token } = useAuth();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

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
          status: editForm.status || race.status,
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

  async function handleStepperRequest(next: RaceStatus, label: string) {
    const ok = await confirm({
      title: 'Đổi trạng thái giải',
      description: `Chuyển trạng thái giải sang "${label}"?`,
      confirmText: 'Xác nhận',
      variant: 'default',
    });
    if (!ok || !token) return;
    try {
      const { error } = await racesControllerUpdateStatus({
        path: { id: raceId },
        body: { status: next } as Parameters<typeof racesControllerUpdateStatus>[0]['body'],
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success(`Đã chuyển sang ${next}`);
      onRefetch();
    } catch {
      toast.error('Cập nhật trạng thái thất bại');
    }
  }

  async function handleOverrideConfirm(next: RaceStatus, reason: string) {
    if (!token) throw new Error('No auth');
    try {
      const { error } = await racesControllerForceUpdateStatus({
        path: { id: raceId },
        body: { status: next, reason },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success(`Đã override trạng thái sang "${next}"`);
      setOverrideOpen(false);
      onRefetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Override thất bại');
      throw e;
    }
  }

  return (
    <section id="race-meta" className="scroll-mt-24" aria-labelledby="race-meta-heading">
      <Card>
        <CardHeader>
          <CardTitle id="race-meta-heading">Thông tin giải chạy</CardTitle>
          <CardDescription>Cập nhật thông tin cơ bản của giải</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Lifecycle stepper */}
          <div className="flex flex-col gap-3">
            <Label>Trạng thái giải đấu</Label>
            <LifecycleStepper
              current={race.status}
              history={race.statusHistory}
              onRequestChange={handleStepperRequest}
            />

            {/* Override entry */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2">
              <div className="flex items-start gap-2 min-w-0">
                <ShieldAlert className="size-4 shrink-0 text-orange-600 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-semibold text-orange-900">
                    Override trạng thái (admin)
                  </span>
                  <span className="text-[11px] text-orange-700/80">
                    Bỏ qua luật forward-only khi cần sửa nhầm — bắt buộc nhập lý do, có audit log.
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800 shrink-0"
                onClick={() => setOverrideOpen(true)}
                data-testid="override-open"
              >
                Override
              </Button>
            </div>
          </div>

          <OverrideStatusDialog
            open={overrideOpen}
            onOpenChange={setOverrideOpen}
            current={race.status}
            onConfirm={handleOverrideConfirm}
          />

          <Separator />

          {/* Identity / place-time grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Tên giải</Label>
              <Input
                id="edit-title"
                value={editForm.title ?? ''}
                onChange={(e) => update({ title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-slug">Đường dẫn SEO</Label>
              <Input
                id="edit-slug"
                value={editForm.slug ?? ''}
                onChange={(e) => update({ slug: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-type">Loại hình</Label>
              <Input
                id="edit-type"
                value={editForm.raceType ?? ''}
                onChange={(e) => update({ raceType: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-province">Tỉnh/Thành</Label>
              <Input
                id="edit-province"
                value={editForm.province ?? ''}
                onChange={(e) => update({ province: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-location">Địa điểm</Label>
              <Input
                id="edit-location"
                value={editForm.location ?? ''}
                onChange={(e) => update({ location: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-organizer">Ban tổ chức</Label>
              <Input
                id="edit-organizer"
                value={editForm.organizer ?? ''}
                onChange={(e) => update({ organizer: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-season">Mùa giải</Label>
              <Input
                id="edit-season"
                value={editForm.season ?? ''}
                onChange={(e) => update({ season: e.target.value })}
                placeholder="2026"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-start">Ngày bắt đầu</Label>
              <Input
                id="edit-start"
                type="date"
                value={editForm.startDate?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  update({
                    startDate: e.target.value
                      ? e.target.value + 'T00:00:00.000Z'
                      : undefined,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-end">Ngày kết thúc</Label>
              <Input
                id="edit-end"
                type="date"
                value={editForm.endDate?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  update({
                    endDate: e.target.value
                      ? e.target.value + 'T00:00:00.000Z'
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Description (BR-AS-43 normalized to shadcn Textarea) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-desc">Mô tả</Label>
            <Textarea
              id="edit-desc"
              rows={3}
              value={editForm.description ?? ''}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Mô tả giải chạy..."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4 mr-2" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default RaceMetaSection;
