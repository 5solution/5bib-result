'use client';

import { use, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCrewBatch,
  useUpdateBatch,
  useConfirmRoster,
  useRecipients,
  useCrewPositions,
  useCrewFonts,
} from '@/lib/crew-cert-hooks';
import {
  rosterPreview,
  uploadCrewImage,
  previewDraft,
  CrewCertApiError,
  type CrewTemplate,
  type CrewTemplateLayer,
  type CrewNamedTemplate,
  type RosterPreview,
} from '@/lib/crew-cert-api';

interface TextLayerDraft {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  fontFamily: string;
}

/** Editor fields cho 1 phôi (default hoặc phụ). */
interface TplFields {
  bgUrl: string;
  canvasW: number;
  canvasH: number;
  layers: TextLayerDraft[];
  photo: { enabled: boolean; x: number; y: number; width: number; height: number };
}

/** 1 phôi trong danh sách (index 0 = phôi mặc định). */
interface Phoi {
  name: string;
  positions: string[];
  fields: TplFields;
}

const EMPTY_FIELDS: TplFields = {
  bgUrl: '',
  canvasW: 1000,
  canvasH: 700,
  layers: [],
  photo: { enabled: false, x: 60, y: 200, width: 200, height: 200 },
};
const MAX_SUB_TEMPLATES = 10;

function templateToFields(t: CrewTemplate | null | undefined): TplFields {
  if (!t) return { ...EMPTY_FIELDS, layers: [], photo: { ...EMPTY_FIELDS.photo } };
  const layers = (t.layers ?? [])
    .filter((l) => l.type === 'text')
    .map((l) => ({
      text: l.text ?? '',
      x: l.x,
      y: l.y,
      fontSize: l.fontSize ?? 40,
      color: l.color ?? '#111111',
      textAlign: (l.textAlign ?? 'center') as TextLayerDraft['textAlign'],
      fontFamily: l.fontFamily ?? 'Be Vietnam Pro',
    }));
  const ph = (t.layers ?? []).find((l) => l.type === 'photo');
  return {
    bgUrl: t.canvas.backgroundImageUrl ?? '',
    canvasW: t.canvas.width,
    canvasH: t.canvas.height,
    layers,
    photo: ph
      ? { enabled: true, x: ph.x, y: ph.y, width: ph.width ?? 200, height: ph.height ?? 200 }
      : { ...EMPTY_FIELDS.photo },
  };
}

function fieldsToTemplate(f: TplFields): CrewTemplate {
  const built: CrewTemplateLayer[] = f.layers.map((l) => {
    // Căn giữa: neo full canvas (x=0, width=canvasW) → render engine center = canvasW/2,
    // KHỚP đúng khung kéo-thả (overlay centered căn theo giữa canvas). Nếu để x=l.x thì
    // tâm chữ = (l.x+canvasW)/2 → lệch phải l.x/2 (bug "cứ lệch lệch").
    const centered = l.textAlign === 'center';
    return {
      type: 'text' as const,
      x: centered ? 0 : l.x,
      y: l.y,
      width: centered ? f.canvasW : f.canvasW - l.x,
      text: l.text,
      fontSize: l.fontSize,
      color: l.color,
      textAlign: l.textAlign,
      fontFamily: l.fontFamily || 'Be Vietnam Pro',
    };
  });
  if (f.photo.enabled) {
    built.push({ type: 'photo', x: f.photo.x, y: f.photo.y, width: f.photo.width, height: f.photo.height });
  }
  return {
    canvas: {
      width: f.canvasW,
      height: f.canvasH,
      backgroundColor: '#ffffff',
      backgroundImageUrl: f.bgUrl || undefined,
    },
    layers: built,
  };
}

export default function CrewBatchEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: batch, isLoading } = useCrewBatch(id);
  const updateMut = useUpdateBatch(id);
  const confirmMut = useConfirmRoster(id);
  const { data: recipients } = useRecipients(id);
  const { data: positionsData } = useCrewPositions(id);
  const distinctPositions = positionsData?.positions ?? [];
  const { data: fonts } = useCrewFonts();
  const fontList = fonts ?? [{ family: 'Be Vietnam Pro', label: 'Be Vietnam Pro', category: 'sans' }];

  // info
  const [eventName, setEventName] = useState('');
  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);

  // ── FEATURE-094 multi-phôi ──
  // phoiList[0] = phôi mặc định; [1..] = phôi phụ theo vị trí.
  const [phoiList, setPhoiList] = useState<Phoi[]>([
    { name: 'Phôi mặc định', positions: [], fields: { ...EMPTY_FIELDS } },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Editor flat-state = bản làm việc của phôi đang chọn.
  const [bgUrl, setBgUrl] = useState('');
  const [canvasW, setCanvasW] = useState(1000);
  const [canvasH, setCanvasH] = useState(700);
  const [layers, setLayers] = useState<TextLayerDraft[]>([]);
  const [photo, setPhoto] = useState(EMPTY_FIELDS.photo);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // roster
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load batch → build phoiList + nạp phôi mặc định vào editor.
  useEffect(() => {
    if (!batch) return;
    setEventName(batch.eventName);
    setSlug(batch.slug);
    setActive(batch.active);
    const list: Phoi[] = [
      { name: 'Phôi mặc định', positions: [], fields: templateToFields(batch.template) },
      ...(batch.templates ?? []).map((t) => ({
        name: t.name,
        positions: t.positions ?? [],
        fields: templateToFields(t.template),
      })),
    ];
    setPhoiList(list);
    setActiveIdx(0);
    loadFields(list[0].fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch]);

  function loadFields(f: TplFields) {
    setBgUrl(f.bgUrl);
    setCanvasW(f.canvasW);
    setCanvasH(f.canvasH);
    setLayers(f.layers);
    setPhoto(f.photo);
  }
  function currentFields(): TplFields {
    return { bgUrl, canvasW, canvasH, layers, photo };
  }
  /** Ghi editor flat-state hiện tại vào phoiList[activeIdx], trả về list mới. */
  function commitActive(list = phoiList): Phoi[] {
    return list.map((p, i) => (i === activeIdx ? { ...p, fields: currentFields() } : p));
  }
  function switchPhoi(idx: number) {
    if (idx === activeIdx) return;
    const committed = commitActive();
    setPhoiList(committed);
    setActiveIdx(idx);
    loadFields(committed[idx].fields);
  }
  function addPhoi() {
    if (phoiList.length - 1 >= MAX_SUB_TEMPLATES) return;
    const committed = commitActive();
    const next: Phoi = {
      name: `Phôi ${committed.length}`,
      positions: [],
      fields: { ...EMPTY_FIELDS, layers: [], photo: { ...EMPTY_FIELDS.photo } },
    };
    const list = [...committed, next];
    setPhoiList(list);
    setActiveIdx(list.length - 1);
    loadFields(next.fields);
  }
  function removePhoi(idx: number) {
    if (idx === 0) return; // không xoá default
    const committed = commitActive();
    const list = committed.filter((_, i) => i !== idx);
    setPhoiList(list);
    const nextIdx = Math.max(0, idx - 1);
    setActiveIdx(nextIdx);
    loadFields(list[nextIdx].fields);
  }
  function renameActive(name: string) {
    setPhoiList((prev) => prev.map((p, i) => (i === activeIdx ? { ...p, name } : p)));
  }
  /** Gán/bỏ 1 position vào phôi đang chọn (mỗi position chỉ 1 phôi — gỡ khỏi phôi khác). */
  function togglePosition(pos: string) {
    setPhoiList((prev) =>
      prev.map((p, i) => {
        if (i === activeIdx) {
          const has = p.positions.includes(pos);
          return { ...p, positions: has ? p.positions.filter((x) => x !== pos) : [...p.positions, pos] };
        }
        // đảm bảo unique: gỡ pos khỏi phôi khác nếu đang gán cho phôi active
        return { ...p, positions: p.positions.filter((x) => x !== pos) };
      }),
    );
  }

  const slugValid = /^[a-z0-9-]{3,60}$/.test(slug);
  const activePhoi = phoiList[activeIdx];
  const isSubTemplate = activeIdx > 0;
  // vị trí đã gán cho phôi KHÁC (để disable trong multi-select của phôi active)
  const assignedElsewhere = new Set(
    phoiList.flatMap((p, i) => (i === activeIdx ? [] : p.positions)),
  );
  const unassignedCount = distinctPositions.filter(
    (pos) => !phoiList.some((p) => p.positions.includes(pos)),
  ).length;
  // phôi phụ hợp lệ để lưu: có nền hoặc ≥1 layer, và ≥1 position
  const invalidSub = phoiList.some(
    (p, i) =>
      i > 0 &&
      (p.positions.length === 0 || (!p.fields.bgUrl && p.fields.layers.length === 0)),
  );

  async function saveInfo() {
    try {
      await updateMut.mutateAsync({ eventName: eventName.trim(), slug: slug.trim(), active });
      toast.success('Đã lưu thông tin');
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Lưu thất bại');
    }
  }

  function buildTemplate() {
    return fieldsToTemplate(currentFields());
  }

  async function saveTemplate() {
    // commit phôi đang chỉnh trước khi build tất cả
    const list = commitActive();
    const namedTemplates: CrewNamedTemplate[] = list.slice(1).map((p) => ({
      name: p.name.trim() || 'Phôi',
      positions: p.positions,
      template: fieldsToTemplate(p.fields),
    }));
    try {
      await updateMut.mutateAsync({
        template: fieldsToTemplate(list[0].fields),
        templates: namedTemplates,
      });
      setPhoiList(list);
      toast.success('Đã lưu cấu hình phôi');
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Lưu phôi thất bại');
    }
  }

  // LIVE preview: render phôi ĐANG CHỌN (chưa lưu) mỗi khi đổi layer/canvas (debounce 600ms).
  async function refreshPreview() {
    try {
      setPreviewing(true);
      const src = await previewDraft(id, buildTemplate() as CrewTemplate);
      setPreviewSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return src;
      });
    } catch {
      /* giữ ảnh preview cũ nếu render lỗi */
    } finally {
      setPreviewing(false);
    }
  }

  useEffect(() => {
    if (!batch) return;
    const t = setTimeout(() => void refreshPreview(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, layers, photo, canvasW, canvasH, bgUrl, activeIdx]);

  // ─── Kéo-thả vị trí trên ảnh preview ───
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: 'layer' | 'photo';
    index: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    centered: boolean;
  } | null>(null);

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(v)));
  }

  function startDrag(e: React.PointerEvent, kind: 'layer' | 'photo', index: number) {
    e.preventDefault();
    const base = kind === 'layer' ? layers[index] : photo;
    dragRef.current = {
      kind,
      index,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: base.x,
      startY: base.y,
      centered: kind === 'layer' && layers[index].textAlign === 'center',
    };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const dx = ((ev.clientX - d.startClientX) / rect.width) * canvasW;
      const dy = ((ev.clientY - d.startClientY) / rect.height) * canvasH;
      const ny = clamp(d.startY + dy, 0, canvasH);
      if (d.kind === 'layer') {
        const patch = d.centered ? { y: ny } : { x: clamp(d.startX + dx, 0, canvasW), y: ny };
        setLayers((prev) => prev.map((l, j) => (j === d.index ? { ...l, ...patch } : l)));
      } else {
        const nx = clamp(d.startX + dx, 0, canvasW);
        setPhoto((p) => ({ ...p, x: nx, y: ny }));
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function tokenLabel(text: string): string {
    if (text.includes('{full_name}')) return 'Họ tên';
    if (text.includes('{position}')) return 'Vị trí';
    if (text.includes('{event_name}')) return 'Sự kiện';
    return text.slice(0, 16) || 'Chữ';
  }

  async function onBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCrewImage(file);
      setBgUrl(url);
      toast.success('Đã tải phôi nền');
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Tải ảnh thất bại');
    } finally {
      setUploading(false);
    }
  }

  async function onRosterFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPreview(await rosterPreview(id, file));
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Đọc file thất bại');
    }
  }

  async function confirmRoster() {
    if (!preview?.valid.length) return;
    try {
      const res = await confirmMut.mutateAsync(preview.valid);
      toast.success(`Đã nhập ${res.inserted} crew`);
      setPreview(null);
    } catch {
      toast.error('Nhập thất bại');
    }
  }

  function downloadSample() {
    const csv = 'Họ tên,Vị trí,Đơn vị\nNguyễn Văn A,Trạm nước số 1,CLB Chạy Bộ X\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mau-roster-crew.csv';
    a.click();
  }

  if (isLoading || !batch) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  const tokens = ['{full_name}', '{position}', '{event_name}', ...batch.extraFields.map((k) => `{${k}}`)];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{batch.eventName}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          Link công khai: <a className="text-primary underline" href={`/gcn/${batch.slug}`} target="_blank" rel="noreferrer">/gcn/{batch.slug}</a>
        </p>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="template">Phôi GCN ({phoiList.length})</TabsTrigger>
          <TabsTrigger value="crew">Danh sách Crew ({batch.recipientCount})</TabsTrigger>
        </TabsList>

        {/* ── Thông tin ── */}
        <TabsContent value="info">
          <Card className="max-w-lg space-y-4 p-6">
            <div className="space-y-1.5">
              <Label>Tên sự kiện</Label>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Đường dẫn (slug)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              {slug && !slugValid && <p className="text-xs text-destructive">Slug không hợp lệ (a-z, 0-9, -, 3–60)</p>}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Đang bật (cho phép crew tìm)</Label>
            </div>
            <Button onClick={saveInfo} disabled={!eventName.trim() || !slugValid || updateMut.isPending}>
              {updateMut.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
            </Button>
          </Card>
        </TabsContent>

        {/* ── Phôi GCN (multi) ── */}
        <TabsContent value="template" className="space-y-4">
          {/* Thanh chọn phôi */}
          <Card className="flex flex-wrap items-center gap-2 p-3">
            {phoiList.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => switchPhoi(i)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  i === activeIdx
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent'
                }`}
              >
                {i === 0 ? 'Phôi mặc định' : p.name || `Phôi ${i}`}
                {i > 0 && p.positions.length > 0 && (
                  <span className="ml-1 opacity-70">· {p.positions.length} vị trí</span>
                )}
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={addPhoi}
              disabled={phoiList.length - 1 >= MAX_SUB_TEMPLATES}
            >
              + Thêm phôi
            </Button>
            {isSubTemplate && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removePhoi(activeIdx)}>
                Xoá phôi này
              </Button>
            )}
            {unassignedCount > 0 && distinctPositions.length > 0 && (
              <span className="ml-auto text-xs text-amber-600">
                {unassignedCount} vị trí chưa gán → dùng phôi mặc định
              </span>
            )}
          </Card>

          {/* Cấu hình phôi phụ: tên + gán vị trí */}
          {isSubTemplate && (
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tên phôi</Label>
                  <Input className="w-56" value={activePhoi?.name ?? ''} onChange={(e) => renameActive(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vị trí áp dụng phôi này</Label>
                {distinctPositions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có roster — upload danh sách crew ở tab &quot;Danh sách Crew&quot; trước.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {distinctPositions.map((pos) => {
                      const selected = activePhoi?.positions.includes(pos) ?? false;
                      const disabled = !selected && assignedElsewhere.has(pos);
                      return (
                        <button
                          key={pos}
                          type="button"
                          disabled={disabled}
                          onClick={() => togglePosition(pos)}
                          title={disabled ? 'Đã gán cho phôi khác' : undefined}
                          className={`rounded-full border px-3 py-1 text-sm transition ${
                            selected
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700'
                              : disabled
                                ? 'cursor-not-allowed border-input bg-muted text-muted-foreground opacity-60'
                                : 'border-input bg-background hover:bg-accent'
                          }`}
                        >
                          {selected ? '✓ ' : ''}{pos}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isSubTemplate && (activePhoi?.positions.length ?? 0) === 0 && (
                  <p className="text-xs text-destructive">Chọn ít nhất 1 vị trí cho phôi này.</p>
                )}
              </div>
            </Card>
          )}

          {/* Editor + preview (thao tác phôi đang chọn) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label>Ảnh phôi nền {isSubTemplate ? `— ${activePhoi?.name}` : '(mặc định)'}</Label>
                <input type="file" accept="image/*" onChange={onBgFile} />
                {uploading && <p className="text-xs text-muted-foreground">Đang tải…</p>}
                {bgUrl && <p className="truncate font-mono text-xs text-muted-foreground" title={bgUrl}>{bgUrl}</p>}
              </div>
              <div className="flex gap-3">
                <div className="space-y-1.5">
                  <Label>Rộng (px)</Label>
                  <Input type="number" value={canvasW} onChange={(e) => setCanvasW(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cao (px)</Label>
                  <Input type="number" value={canvasH} onChange={(e) => setCanvasH(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Lớp chữ</Label>
                  <Button size="sm" variant="outline" onClick={() => setLayers([...layers, { text: '{full_name}', x: 100, y: 300, fontSize: 48, color: '#111111', textAlign: 'center', fontFamily: 'Be Vietnam Pro' }])}>
                    + Thêm dòng
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Token khả dụng: {tokens.join(' ')}</p>
                {layers.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 items-end gap-2 rounded border p-2">
                    <div className="col-span-8">
                      <Input value={l.text} onChange={(e) => updateLayer(i, { text: e.target.value })} placeholder="{full_name}" />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Phông</Label>
                      <select
                        className="h-9 w-full rounded border bg-background px-1 text-sm"
                        value={l.fontFamily}
                        onChange={(e) => updateLayer(i, { fontFamily: e.target.value })}
                      >
                        {fontList.map((f) => (
                          <option key={f.family} value={f.family}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <NumberField label="X" value={l.x} onChange={(v) => updateLayer(i, { x: v })} span={2} />
                    <NumberField label="Y" value={l.y} onChange={(v) => updateLayer(i, { y: v })} span={2} />
                    <NumberField label="Cỡ" value={l.fontSize} onChange={(v) => updateLayer(i, { fontSize: v })} span={2} />
                    <div className="col-span-2">
                      <Label className="text-xs">Màu</Label>
                      <Input type="color" value={l.color} onChange={(e) => updateLayer(i, { color: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Căn</Label>
                      <select className="h-9 w-full rounded border bg-background px-1 text-sm" value={l.textAlign} onChange={(e) => updateLayer(i, { textAlign: e.target.value as TextLayerDraft['textAlign'] })}>
                        <option value="left">Trái</option>
                        <option value="center">Giữa</option>
                        <option value="right">Phải</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setLayers(layers.filter((_, j) => j !== i))}>Xoá</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded border p-2">
                <div className="flex items-center gap-3">
                  <Switch checked={photo.enabled} onCheckedChange={(v) => setPhoto({ ...photo, enabled: v })} />
                  <Label>Có ô ảnh chân dung</Label>
                </div>
                {photo.enabled && (
                  <div className="grid grid-cols-4 gap-2">
                    <NumberField label="X" value={photo.x} onChange={(v) => setPhoto({ ...photo, x: v })} span={1} />
                    <NumberField label="Y" value={photo.y} onChange={(v) => setPhoto({ ...photo, y: v })} span={1} />
                    <NumberField label="Rộng" value={photo.width} onChange={(v) => setPhoto({ ...photo, width: v })} span={1} />
                    <NumberField label="Cao" value={photo.height} onChange={(v) => setPhoto({ ...photo, height: v })} span={1} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={saveTemplate} disabled={updateMut.isPending || invalidSub}>
                  {updateMut.isPending ? 'Đang lưu…' : 'Lưu cấu hình phôi'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Lưu tất cả phôi (mặc định + phụ) cùng lúc.
                  {invalidSub && <span className="text-destructive"> Có phôi phụ thiếu nền/chữ hoặc chưa gán vị trí.</span>}
                </span>
              </div>
            </Card>

            <Card className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <Label>Xem trước — {isSubTemplate ? activePhoi?.name : 'Phôi mặc định'}</Label>
                {previewing && <span className="text-xs text-muted-foreground">Đang render…</span>}
              </div>
              {previewSrc ? (
                <>
                  <div ref={wrapRef} className="relative w-full select-none touch-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewSrc} alt="preview GCN" className="block w-full rounded border" draggable={false} />
                    {layers.map((l, i) => {
                      const centered = l.textAlign === 'center';
                      const topPct = (l.y / canvasH) * 100;
                      const hPct = Math.max(2, ((l.fontSize * 1.5) / canvasH) * 100);
                      const leftPct = centered ? 0 : (l.x / canvasW) * 100;
                      const wPct = centered ? 100 : Math.max(8, 100 - leftPct);
                      return (
                        <div
                          key={i}
                          onPointerDown={(e) => startDrag(e, 'layer', i)}
                          title={`Kéo để di chuyển "${tokenLabel(l.text)}"`}
                          style={{ top: `${topPct}%`, left: `${leftPct}%`, width: `${wPct}%`, height: `${hPct}%` }}
                          className={`group absolute flex items-center justify-center rounded border border-dashed border-blue-500/70 bg-blue-500/5 hover:bg-blue-500/15 ${centered ? 'cursor-ns-resize' : 'cursor-move'}`}
                        >
                          <span className="pointer-events-none rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                            {tokenLabel(l.text)} ⠿
                          </span>
                        </div>
                      );
                    })}
                    {photo.enabled && (
                      <div
                        onPointerDown={(e) => startDrag(e, 'photo', 0)}
                        title="Kéo để di chuyển ô ảnh"
                        style={{
                          top: `${(photo.y / canvasH) * 100}%`,
                          left: `${(photo.x / canvasW) * 100}%`,
                          width: `${(photo.width / canvasW) * 100}%`,
                          height: `${(photo.height / canvasH) * 100}%`,
                        }}
                        className="absolute cursor-move rounded border border-dashed border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Kéo khung nét đứt để chỉnh vị trí. Ưng → “Lưu cấu hình phôi”.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tải phôi nền + thêm dòng chữ để xem trước.
                </p>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── Crew ── */}
        <TabsContent value="crew">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={downloadSample}>Tải file mẫu (CSV)</Button>
              <input type="file" accept=".xlsx,.csv" onChange={onRosterFile} />
            </div>
            {preview && (
              <div className="space-y-2 rounded border p-3">
                <p className="text-sm">
                  Tổng {preview.total} dòng — <span className="text-green-600">{preview.valid.length} hợp lệ</span>
                  {preview.invalid.length > 0 && <span className="text-destructive"> · {preview.invalid.length} lỗi</span>}
                </p>
                {preview.invalid.slice(0, 5).map((iv) => (
                  <p key={iv.rowNumber} className="text-xs text-destructive">Dòng {iv.rowNumber}: {iv.reason}</p>
                ))}
                <Button size="sm" onClick={confirmRoster} disabled={!preview.valid.length || confirmMut.isPending}>
                  {confirmMut.isPending ? 'Đang nhập…' : `Xác nhận nhập ${preview.valid.length} crew (thay danh sách cũ)`}
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Vị trí</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recipients ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell>{r.position}</TableCell>
                  </TableRow>
                ))}
                {(recipients ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">Chưa có crew.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  function updateLayer(i: number, patch: Partial<TextLayerDraft>) {
    setLayers((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
}

function NumberField({ label, value, onChange, span = 2 }: { label: string; value: number; onChange: (v: number) => void; span?: number }) {
  return (
    <div style={{ gridColumn: `span ${span} / span ${span}` }}>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
