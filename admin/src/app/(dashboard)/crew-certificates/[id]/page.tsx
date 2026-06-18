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
import { useCrewBatch, useUpdateBatch, useConfirmRoster, useRecipients } from '@/lib/crew-cert-hooks';
import {
  rosterPreview,
  uploadCrewImage,
  previewDraft,
  CrewCertApiError,
  type CrewTemplate,
  type CrewTemplateLayer,
  type RosterPreview,
} from '@/lib/crew-cert-api';

interface TextLayerDraft {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
}

export default function CrewBatchEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: batch, isLoading } = useCrewBatch(id);
  const updateMut = useUpdateBatch(id);
  const confirmMut = useConfirmRoster(id);
  const { data: recipients } = useRecipients(id);

  // info
  const [eventName, setEventName] = useState('');
  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);
  // template
  const [bgUrl, setBgUrl] = useState('');
  const [canvasW, setCanvasW] = useState(1000);
  const [canvasH, setCanvasH] = useState(700);
  const [layers, setLayers] = useState<TextLayerDraft[]>([]);
  const [photo, setPhoto] = useState({ enabled: false, x: 60, y: 200, width: 200, height: 200 });
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // roster
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!batch) return;
    setEventName(batch.eventName);
    setSlug(batch.slug);
    setActive(batch.active);
    const t = batch.template;
    if (t) {
      setBgUrl(t.canvas.backgroundImageUrl ?? '');
      setCanvasW(t.canvas.width);
      setCanvasH(t.canvas.height);
      setLayers(
        (t.layers ?? [])
          .filter((l) => l.type === 'text')
          .map((l) => ({
            text: l.text ?? '',
            x: l.x,
            y: l.y,
            fontSize: l.fontSize ?? 40,
            color: l.color ?? '#111111',
            textAlign: (l.textAlign ?? 'center') as TextLayerDraft['textAlign'],
          })),
      );
      const ph = (t.layers ?? []).find((l) => l.type === 'photo');
      if (ph) setPhoto({ enabled: true, x: ph.x, y: ph.y, width: ph.width ?? 200, height: ph.height ?? 200 });
    }
  }, [batch]);

  const slugValid = /^[a-z0-9-]{3,60}$/.test(slug);

  async function saveInfo() {
    try {
      await updateMut.mutateAsync({ eventName: eventName.trim(), slug: slug.trim(), active });
      toast.success('Đã lưu thông tin');
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Lưu thất bại');
    }
  }

  function buildTemplate() {
    const built: CrewTemplateLayer[] = layers.map((l) => ({
      type: 'text',
      x: l.x,
      y: l.y,
      width: canvasW - l.x,
      text: l.text,
      fontSize: l.fontSize,
      color: l.color,
      textAlign: l.textAlign,
      fontFamily: 'Be Vietnam Pro',
    }));
    if (photo.enabled) {
      built.push({ type: 'photo', x: photo.x, y: photo.y, width: photo.width, height: photo.height });
    }
    return {
      canvas: { width: canvasW, height: canvasH, backgroundColor: '#ffffff', backgroundImageUrl: bgUrl || undefined },
      layers: built,
    };
  }

  async function saveTemplate() {
    try {
      await updateMut.mutateAsync({ template: buildTemplate() });
      toast.success('Đã lưu phôi');
    } catch (err) {
      toast.error(err instanceof CrewCertApiError ? err.message : 'Lưu phôi thất bại');
    }
  }

  // LIVE preview: render phôi CHƯA lưu mỗi khi đổi layer/canvas (debounce 600ms),
  // KHÔNG cần bấm lưu — giống /certificates. Tách hẳn khỏi "Lưu phôi".
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
    if (!batch) return; // chờ load xong mới preview
    const t = setTimeout(() => void refreshPreview(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, layers, photo, canvasW, canvasH, bgUrl]);

  // ─── Kéo-thả vị trí trên ảnh preview (thay vì gõ toạ độ X/Y) ───
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

  function startDrag(
    e: React.PointerEvent,
    kind: 'layer' | 'photo',
    index: number,
  ) {
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
        // chữ căn giữa: chỉ chỉnh dọc (Y); căn trái/phải: chỉnh cả X + Y
        const patch = d.centered
          ? { y: ny }
          : { x: clamp(d.startX + dx, 0, canvasW), y: ny };
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
          <TabsTrigger value="template">Phôi GCN</TabsTrigger>
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

        {/* ── Phôi GCN ── */}
        <TabsContent value="template">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label>Ảnh phôi nền</Label>
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
                  <Button size="sm" variant="outline" onClick={() => setLayers([...layers, { text: '{full_name}', x: 100, y: 300, fontSize: 48, color: '#111111', textAlign: 'center' }])}>
                    + Thêm dòng
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Token khả dụng: {tokens.join(' ')}</p>
                {layers.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 items-end gap-2 rounded border p-2">
                    <div className="col-span-12">
                      <Input value={l.text} onChange={(e) => updateLayer(i, { text: e.target.value })} placeholder="{full_name}" />
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
                <Button onClick={saveTemplate} disabled={updateMut.isPending}>
                  {updateMut.isPending ? 'Đang lưu…' : 'Lưu phôi'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Xem trước tự cập nhật bên phải khi bạn chỉnh — bấm “Lưu phôi” để lưu lại.
                </span>
              </div>
            </Card>

            <Card className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <Label>Xem trước (dữ liệu mẫu)</Label>
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
                    💡 Kéo khung nét đứt trên ảnh để chỉnh vị trí (chữ căn giữa kéo lên/xuống). Ưng → “Lưu phôi”.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {batch?.template ? 'Đang tải xem trước…' : 'Tải phôi nền + thêm dòng chữ để xem trước.'}
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
