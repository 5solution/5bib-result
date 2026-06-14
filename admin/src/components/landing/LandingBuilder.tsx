'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useLanding,
  usePublishLanding,
  useReorderSections,
  useUpdateLanding,
} from '@/lib/landing-hooks';
import {
  LandingApiError,
  type LandingAdmin,
  type LandingSectionAdmin,
} from '@/lib/landing-api';
import {
  AUTO_DATA_SECTIONS,
  SECTION_TYPE_LABEL,
  THEME_PRESETS,
  VARIANTS_BY_TYPE,
  VARIANT_LABEL,
} from '@/lib/landing-labels';
import SectionForm from './SectionForm';

type Tab = 'sections' | 'theme' | 'domain' | 'seo';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sections', label: 'Section' },
  { id: 'theme', label: 'Giao diện' },
  { id: 'domain', label: 'Tên miền' },
  { id: 'seo', label: 'SEO' },
];

export default function LandingBuilder({ id }: { id: string }) {
  const { data, isLoading } = useLanding(id);
  const updateMut = useUpdateLanding(id);
  const reorderMut = useReorderSections(id);
  const publishMut = usePublishLanding(id);

  const [draft, setDraft] = useState<LandingAdmin | null>(null);
  const [tab, setTab] = useState<Tab>('sections');

  useEffect(() => {
    if (data && (!draft || draft.id !== data.id)) {
      setDraft(structuredClone(data));
    }
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sorted = [...draft.sections].sort((a, b) => a.order - b.order);

  function patch(next: Partial<LandingAdmin>) {
    setDraft((d) => (d ? { ...d, ...next } : d));
  }
  function patchSection(sid: string, next: Partial<LandingSectionAdmin>) {
    setDraft((d) =>
      d
        ? { ...d, sections: d.sections.map((s) => (s.id === sid ? { ...s, ...next } : s)) }
        : d,
    );
  }
  function move(sid: string, dir: -1 | 1) {
    const arr = [...draft!.sections].sort((a, b) => a.order - b.order);
    const i = arr.findIndex((s) => s.id === sid);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i].order, arr[j].order] = [arr[j].order, arr[i].order];
    patch({ sections: arr });
  }
  async function save() {
    if (!draft) return;
    try {
      await updateMut.mutateAsync({
        internalName: draft.internalName,
        meta: draft.meta,
        theme: draft.theme,
        domain: { subdomain: draft.domain.subdomain },
      });
      const saved = await reorderMut.mutateAsync(
        draft.sections.map((s) => ({
          id: s.id,
          type: s.type,
          variant: s.variant,
          enabled: s.enabled,
          order: s.order,
          anchor: s.anchor,
          data: s.data,
        })),
      );
      setDraft(structuredClone(saved));
      toast.success('Đã lưu nháp');
    } catch (err) {
      toast.error(err instanceof LandingApiError ? err.message : 'Lưu thất bại');
    }
  }

  async function publish() {
    try {
      const res = await publishMut.mutateAsync();
      setDraft(structuredClone(res));
      toast.success(`Đã publish lên ${res.domain.subdomain}.5bib.com`);
    } catch (err) {
      toast.error(err instanceof LandingApiError ? err.message : 'Publish thất bại');
    }
  }

  const saving = updateMut.isPending || reorderMut.isPending;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{draft.meta.title ?? draft.internalName ?? 'Trang giải'}</h1>
          {draft.domain.subdomain && (
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {draft.domain.subdomain}.5bib.com
            </span>
          )}
          {draft.publish.hasUnpublishedChanges && (
            <Badge variant="outline" className="text-amber-600">
              Có thay đổi chưa publish
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {draft.status === 'published' && draft.domain.subdomain && (
            <a
              href={`https://${draft.domain.subdomain}.5bib.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Xem trang ↗
            </a>
          )}
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu nháp'}
          </Button>
          <Button onClick={publish} disabled={publishMut.isPending}>
            {publishMut.isPending ? 'Đang publish…' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sections' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bật/tắt, sắp xếp (▲▼), chọn kiểu và điền nội dung trực quan cho từng section.
          </p>
          {sorted.map((s, idx) => (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) => patchSection(s.id, { enabled: v })}
                />
                <span className="font-medium">{SECTION_TYPE_LABEL[s.type] ?? s.type}</span>
                {AUTO_DATA_SECTIONS.has(s.type) && (
                  <Badge variant="secondary" className="text-xs">Tự động từ dữ liệu giải</Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={s.variant}
                    onChange={(e) => patchSection(s.id, { variant: e.target.value })}
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    {(VARIANTS_BY_TYPE[s.type] ?? ['default']).map((v) => (
                      <option key={v} value={v}>
                        {VARIANT_LABEL[v] ?? v}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => move(s.id, -1)}>
                    ▲
                  </Button>
                  <Button size="sm" variant="ghost" disabled={idx === sorted.length - 1} onClick={() => move(s.id, 1)}>
                    ▼
                  </Button>
                </div>
              </div>
              <div className="mt-4 border-t pt-4">
                <SectionForm
                  type={s.type}
                  data={s.data}
                  onChange={(d) => patchSection(s.id, { data: d })}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'theme' && (
        <Card className="max-w-xl space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => patch({ theme: { ...draft.theme, main: p.main, sec: p.sec, preset: p.id } })}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <span className="h-4 w-4 rounded-full" style={{ background: p.main }} />
                <span className="h-4 w-4 rounded-full" style={{ background: p.sec }} />
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Màu chính</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.theme.main}
                  onChange={(e) => patch({ theme: { ...draft.theme, main: e.target.value } })}
                  className="h-9 w-12 rounded border"
                />
                <Input
                  value={draft.theme.main}
                  onChange={(e) => patch({ theme: { ...draft.theme, main: e.target.value } })}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Màu phụ</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.theme.sec}
                  onChange={(e) => patch({ theme: { ...draft.theme, sec: e.target.value } })}
                  className="h-9 w-12 rounded border"
                />
                <Input
                  value={draft.theme.sec}
                  onChange={(e) => patch({ theme: { ...draft.theme, sec: e.target.value } })}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Độ tối overlay hero ({draft.theme.heroOverlay.toFixed(2)})</Label>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={draft.theme.heroOverlay}
              onChange={(e) => patch({ theme: { ...draft.theme, heroOverlay: Number(e.target.value) } })}
              className="w-full"
            />
          </div>
        </Card>
      )}

      {tab === 'domain' && (
        <Card className="max-w-xl space-y-2 p-5">
          <Label htmlFor="sub">Subdomain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="sub"
              value={draft.domain.subdomain ?? ''}
              onChange={(e) =>
                patch({ domain: { ...draft.domain, subdomain: e.target.value.toLowerCase() } })
              }
              placeholder="halong-marathon"
            />
            <span className="font-mono text-sm text-muted-foreground">.5bib.com</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Chữ thường + số + gạch nối, 3–42 ký tự. Cần subdomain hợp lệ để publish. (Tên miền riêng — Phase 2.)
          </p>
        </Card>
      )}

      {tab === 'seo' && (
        <Card className="max-w-xl space-y-4 p-5">
          <div className="space-y-1">
            <Label>Tiêu đề trang (SEO)</Label>
            <Input
              value={draft.meta.title ?? ''}
              onChange={(e) => patch({ meta: { ...draft.meta, title: e.target.value } })}
            />
          </div>
          <div className="space-y-1">
            <Label>Mô tả</Label>
            <Textarea
              value={draft.meta.description ?? ''}
              onChange={(e) => patch({ meta: { ...draft.meta, description: e.target.value } })}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label>Ảnh OG (URL)</Label>
            <Input
              value={draft.meta.ogImage ?? ''}
              onChange={(e) => patch({ meta: { ...draft.meta, ogImage: e.target.value } })}
              placeholder="https://…"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
