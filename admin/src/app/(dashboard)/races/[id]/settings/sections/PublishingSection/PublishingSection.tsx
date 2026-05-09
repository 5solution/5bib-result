'use client';

/**
 * F-014 BR-AS-47 — Publishing section (8 fields).
 *
 * Verbatim port of legacy `Features` tab (lines 1391–1538). Includes:
 *   - 4 feature toggles (E-Cert, Claim, Live Tracking, 5Pix)
 *   - Conditional `pixEventUrl` (revealed iff `enable5pix === true`)
 *   - 2 privacy toggles (HideStats, PrivateList)
 *   - Conditional `privateListLimit` (revealed iff enablePrivateList)
 *   - Save button
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
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { racesControllerUpdateRace } from '@/lib/api-generated';
import type { EditForm } from '../section-shared.types';

interface PublishingSectionProps {
  raceId: string;
  editForm: EditForm;
  onEditFormChange: (next: EditForm) => void;
  onRefetch: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function PublishingSection(props: PublishingSectionProps) {
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
    <section id="publishing" className="scroll-mt-24" aria-labelledby="publishing-heading">
      <Card>
        <CardHeader>
          <CardTitle id="publishing-heading">Tính năng & Công bố</CardTitle>
          <CardDescription>
            Bật/tắt các tính năng công khai và quyền riêng tư cho giải
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">E-Certificate</Label>
                <p className="text-sm text-muted-foreground">
                  Cho phép VĐV tải chứng nhận hoàn thành
                </p>
              </div>
              <Switch
                checked={editForm.enableEcert ?? false}
                onCheckedChange={(checked) => update({ enableEcert: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Khiếu nại kết quả</Label>
                <p className="text-sm text-muted-foreground">
                  Cho phép VĐV gửi khiếu nại về kết quả
                </p>
              </div>
              <Switch
                checked={editForm.enableClaim ?? false}
                onCheckedChange={(checked) => update({ enableClaim: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Live Tracking</Label>
                <p className="text-sm text-muted-foreground">
                  Hiển thị kết quả realtime trong giải
                </p>
              </div>
              <Switch
                checked={editForm.enableLiveTracking ?? false}
                onCheckedChange={(checked) =>
                  update({ enableLiveTracking: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">5Pix (Ảnh giải chạy)</Label>
                <p className="text-sm text-muted-foreground">
                  Tích hợp tìm ảnh VĐV từ 5Pix
                </p>
              </div>
              <Switch
                checked={editForm.enable5pix ?? false}
                onCheckedChange={(checked) => update({ enable5pix: checked })}
              />
            </div>

            {editForm.enable5pix && (
              <div className="flex flex-col gap-2 pl-4 border-l-2 border-primary/20">
                <Label htmlFor="pix-url">5Pix Event URL</Label>
                <Input
                  id="pix-url"
                  value={editForm.pixEventUrl ?? ''}
                  onChange={(e) => update({ pixEventUrl: e.target.value })}
                  placeholder="https://5pix.vn/event/..."
                />
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Quyền riêng tư
              </p>

              <div className="flex items-center justify-between rounded-lg border p-4 mb-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Ẩn biểu đồ thống kê</Label>
                  <p className="text-sm text-muted-foreground">
                    Ẩn tỉ lệ hoàn thành, phân bổ thời gian, xếp hạng quốc gia trên trang công khai
                  </p>
                </div>
                <Switch
                  checked={editForm.enableHideStats ?? false}
                  onCheckedChange={(checked) =>
                    update({ enableHideStats: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Danh sách riêng tư</Label>
                  <p className="text-sm text-muted-foreground">
                    Ẩn tổng số VĐV, giới hạn danh sách khi không tìm kiếm (vẫn search được theo BIB/tên)
                  </p>
                </div>
                <Switch
                  checked={editForm.enablePrivateList ?? false}
                  onCheckedChange={(checked) =>
                    update({ enablePrivateList: checked })
                  }
                />
              </div>

              {editForm.enablePrivateList && (
                <div className="flex flex-col gap-2 pl-4 border-l-2 border-primary/20 mt-3">
                  <Label htmlFor="private-limit">
                    Số VĐV hiển thị tối đa (khi không search)
                  </Label>
                  <Input
                    id="private-limit"
                    type="number"
                    min={1}
                    max={500}
                    value={editForm.privateListLimit ?? 20}
                    onChange={(e) =>
                      update({
                        privateListLimit: Math.max(
                          1,
                          parseInt(e.target.value) || 20,
                        ),
                      })
                    }
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4 mr-2" />
              {saving ? 'Đang lưu...' : 'Lưu tính năng'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default PublishingSection;
