'use client';

/**
 * F-014 BR-AS-12/13/14 — Athlete edit drawer (shadcn Sheet, right-side).
 *
 * Two-tab layout: "Chỉnh sửa" + "Hồ sơ" (with embedded audit timeline).
 * Single-target drawer — opens from row "Edit" or "View" actions.
 *
 * Edit form posts via `adminControllerEditResult` (existing endpoint —
 * PATCH /api/admin/race-results/:id). Reuses existing audit-trail by
 * appending an `editHistory[]` entry server-side (BR-03 of legacy).
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { adminControllerEditResult } from '@/lib/api-generated';
import { ATHLETES_VN } from '../athletes.microcopy';
import {
  getBib,
  getName,
  getCourseId,
  type AthleteWithStatus,
  type DrawerMode,
} from '../athletes.types';
import { StatusBadge } from './StatusBadge';
import { AuditLogTimeline } from './AuditLogTimeline';

interface AthleteEditDrawerProps {
  open: boolean;
  mode: DrawerMode;
  row: AthleteWithStatus | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface EditFormState {
  name: string;
  gender: string;
  category: string;
  nationality: string;
  club: string;
}

function rowToForm(row: AthleteWithStatus | null): EditFormState {
  return {
    name: String(row?.name ?? row?.Name ?? ''),
    gender: String(row?.gender ?? row?.Gender ?? ''),
    category: String(row?.category ?? row?.Category ?? ''),
    nationality: String(row?.nationality ?? row?.Nationality ?? ''),
    club: String(row?.club ?? row?.Club ?? ''),
  };
}

export function AthleteEditDrawer(props: AthleteEditDrawerProps) {
  const { open, mode, row, onOpenChange, onSaved } = props;
  const { token } = useAuth();
  const [tab, setTab] = useState<'edit' | 'profile'>('edit');
  const [form, setForm] = useState<EditFormState>(rowToForm(row));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(mode === 'profile' ? 'profile' : 'edit');
      setForm(rowToForm(row));
    }
  }, [open, mode, row]);

  const bib = getBib(row ?? {});
  const name = getName(row ?? {});

  const handleSave = async () => {
    if (!token || !row?._id) {
      toast.error(ATHLETES_VN.toastSaveError);
      return;
    }
    setSaving(true);
    try {
      const { error } = await adminControllerEditResult({
        path: { resultId: row._id },
        body: {
          ...form,
          // Backend will append editHistory entry server-side using auth user.
        } as unknown as Parameters<typeof adminControllerEditResult>[0]['body'],
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success(ATHLETES_VN.toastSaveSuccess);
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(ATHLETES_VN.toastSaveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="athlete-drawer"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>
              {mode === 'profile'
                ? ATHLETES_VN.drawerProfileTitle
                : ATHLETES_VN.drawerEditTitle}
            </span>
            {row && <StatusBadge status={row.derivedStatus} />}
          </SheetTitle>
          <SheetDescription>
            BIB <span className="font-mono font-semibold">{bib || '-'}</span>
            {' · '}
            {name || '-'}
            {' · '}
            {getCourseId(row ?? {}) || '-'}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="mt-3">
            <TabsTrigger value="edit">{ATHLETES_VN.drawerTabEdit}</TabsTrigger>
            <TabsTrigger value="profile">
              {ATHLETES_VN.drawerTabProfile}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ed-name">Họ tên</Label>
              <Input
                id="ed-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ed-gender">Giới</Label>
                <Input
                  id="ed-gender"
                  value={form.gender}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gender: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ed-cat">Nhóm tuổi (AG)</Label>
                <Input
                  id="ed-cat"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ed-nat">Quốc tịch</Label>
              <Input
                id="ed-nat"
                value={form.nationality}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nationality: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ed-club">CLB</Label>
              <Input
                id="ed-club"
                value={form.club}
                onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
              />
            </div>
          </TabsContent>

          <TabsContent value="profile" className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <div>
                <span className="block text-xs text-muted-foreground">Chip Time</span>
                <span className="font-mono">
                  {String(row?.chipTime ?? row?.ChipTime ?? '-')}
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Gun Time</span>
                <span className="font-mono">
                  {String(row?.gunTime ?? row?.GunTime ?? '-')}
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Pace</span>
                <span className="font-mono">
                  {String(row?.pace ?? row?.Pace ?? '-')}
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Overall Rank</span>
                <span className="font-mono">
                  {String(row?.overallRank ?? row?.OverallRank ?? '-')}
                </span>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                {ATHLETES_VN.drawerTabAudit}
              </h4>
              <AuditLogTimeline entries={row?.editHistory} />
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-4 flex flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {ATHLETES_VN.drawerClose}
          </Button>
          {tab === 'edit' && (
            <Button onClick={handleSave} disabled={saving} data-testid="drawer-save">
              {saving ? 'Đang lưu...' : ATHLETES_VN.drawerSave}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AthleteEditDrawer;
