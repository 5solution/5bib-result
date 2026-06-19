'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  useBibPassConfig,
  useBibPassRaceOptions,
  useBibPassFonts,
  useBibPassStats,
  useConfirmedAthletes,
  useUpsertBibPassConfig,
  useTestSend,
  useSendBatch,
  useResendOne,
} from '@/lib/bib-pass-hooks';
import {
  previewDraft,
  uploadBibPassImage,
  BibPassApiError,
  type BibPassTemplate,
  type BibPassLayer,
} from '@/lib/bib-pass-api';

interface TextLayerDraft {
  text: string;
  x: number;
  y: number;
  /** Bề rộng ô chữ (px). Quyết định wrap + vùng căn lề (giữa/phải). */
  width: number;
  fontSize: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  fontFamily: string;
  fontWeight: string;
  letterSpacing?: number;
}

/** Trường động đặt được lên khung. `{...}` = token tự thay theo VĐV; "Chữ tự do" = text tĩnh. */
const FIELD_PALETTE: Array<{ label: string; token: string }> = [
  { label: 'Họ tên', token: '{name}' },
  { label: 'Tên trên BIB', token: '{name_on_bib}' },
  { label: 'Số BIB', token: '{bib}' },
  { label: 'CLB / Đội', token: '{club}' },
  { label: 'Passport No.', token: '{passport_no}' },
  { label: 'Chữ tự do', token: 'Nội dung tự do' },
];

const TOKEN_LABELS: Record<string, string> = {
  '{name}': 'Họ tên',
  '{name_on_bib}': 'Tên trên BIB',
  '{bib}': 'Số BIB',
  '{club}': 'CLB / Đội',
  '{passport_no}': 'Passport',
  '{event_name}': 'Tên giải',
  '{location}': 'Địa điểm',
  '{race_day}': 'Ngày thi',
  '{distance}': 'Cự ly',
};

// Canvas blank mặc định (chân dung) — sẽ tự khớp kích thước ảnh khung khi tải.
const DEFAULT_W = 1280;
const DEFAULT_H = 1600;

/** Đọc kích thước thật của ảnh (để canvas khớp khung, KHÔNG bị cắt). */
function readImageDims(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function BibPassEditor({ params }: { params: Promise<{ raceId: string }> }) {
  const { raceId: raceIdStr } = use(params);
  const raceId = Number(raceIdStr);
  const router = useRouter();

  const { data: config, isLoading, isError } = useBibPassConfig(raceId);
  const { data: raceData } = useBibPassRaceOptions();
  const { data: fonts } = useBibPassFonts();
  const { data: stats } = useBibPassStats(raceId);
  const upsertMut = useUpsertBibPassConfig(raceId);
  const testMut = useTestSend(raceId);
  const sendMut = useSendBatch(raceId);
  const resendMut = useResendOne(raceId);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const raceOption = useMemo(
    () => (raceData?.items ?? []).find((r) => r.raceId === raceId),
    [raceData, raceId],
  );

  // ── template state ──
  const [raceName, setRaceName] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [bgUrl, setBgUrl] = useState('');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [canvasW, setCanvasW] = useState(DEFAULT_W);
  const [canvasH, setCanvasH] = useState(DEFAULT_H);
  // Lớp KHÔNG phải text (shape/image) của config cũ — giữ nguyên round-trip.
  const [preserved, setPreserved] = useState<BibPassLayer[]>([]);
  const [layers, setLayers] = useState<TextLayerDraft[]>([]);
  // ── static fields + email ──
  const [location, setLocation] = useState('');
  const [raceDay, setRaceDay] = useState('');
  const [distance, setDistance] = useState('');
  const [passportPrefix, setPassportPrefix] = useState('');
  const [subject, setSubject] = useState('[5BIB] Border Pass của bạn — {event_name}');
  const [bodyHtml, setBodyHtml] = useState('');
  const [fromName, setFromName] = useState('5BIB');
  const [attachmentFilename, setAttachmentFilename] = useState('border-pass-{bib}.png');
  // ── preview / ux ──
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // ── send tab ──
  const [testEmail, setTestEmail] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data: confirmed } = useConfirmedAthletes(raceId, { q: search, page, pageSize: 20 });

  // Prefill raceName from race option (khi config chưa có).
  useEffect(() => {
    if (!raceName && raceOption?.title) setRaceName(raceOption.title);
  }, [raceOption, raceName]);

  // Load config khi có (404 = giải chưa cấu hình → giữ trạng thái trống).
  useEffect(() => {
    if (loaded) return;
    if (!config && !isError) return; // chờ
    if (config) {
      setRaceName(config.raceName || raceOption?.title || '');
      setEnabled(config.enabled);
      setLocation(config.staticFields.location);
      setRaceDay(config.staticFields.raceDay);
      setDistance(config.staticFields.distance);
      setPassportPrefix(config.staticFields.passportPrefix);
      setSubject(config.email.subject || '[5BIB] Border Pass của bạn — {event_name}');
      setBodyHtml(config.email.bodyHtml || '');
      setFromName(config.email.fromName || '5BIB');
      setAttachmentFilename(config.attachmentFilename || 'border-pass-{bib}.png');
      const t = config.template;
      if (t) {
        setBgUrl(t.canvas.backgroundImageUrl ?? '');
        setBgColor(t.canvas.backgroundColor ?? '#ffffff');
        setCanvasW(t.canvas.width);
        setCanvasH(t.canvas.height);
        setPreserved((t.layers ?? []).filter((l) => l.type !== 'text'));
        setLayers(
          (t.layers ?? [])
            .filter((l) => l.type === 'text')
            .map((l) => ({
              text: l.text ?? '',
              x: l.x,
              y: l.y,
              width: l.width && l.width > 0 ? l.width : Math.max(40, t.canvas.width - l.x),
              fontSize: l.fontSize ?? 40,
              color: l.color ?? '#1f2937',
              textAlign: (l.textAlign ?? 'left') as TextLayerDraft['textAlign'],
              fontFamily: l.fontFamily ?? 'Be Vietnam Pro',
              fontWeight: l.fontWeight ?? '700',
              letterSpacing: l.letterSpacing,
            })),
        );
      }
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isError, raceOption]);

  function buildTemplate(): BibPassTemplate {
    const textLayers: BibPassLayer[] = layers.map((l) => ({
      type: 'text',
      x: l.x,
      y: l.y,
      width: l.width && l.width > 0 ? l.width : Math.max(40, canvasW - l.x),
      text: l.text,
      fontSize: l.fontSize,
      color: l.color,
      textAlign: l.textAlign,
      fontFamily: l.fontFamily,
      fontWeight: l.fontWeight,
      ...(l.letterSpacing ? { letterSpacing: l.letterSpacing } : {}),
    }));
    return {
      canvas: {
        width: canvasW,
        height: canvasH,
        backgroundColor: bgColor || '#ffffff',
        backgroundImageUrl: bgUrl || undefined,
      },
      layers: [...preserved, ...textLayers],
    };
  }

  function buildPayload() {
    return {
      raceName: raceName.trim(),
      template: buildTemplate(),
      staticFields: { location, raceDay, distance, passportPrefix },
      email: { subject, bodyHtml, fromName },
      attachmentFilename,
    };
  }

  async function saveAll(opts: { enabled?: boolean } = {}) {
    try {
      await upsertMut.mutateAsync({ ...buildPayload(), ...opts });
      toast.success('Đã lưu');
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Lưu thất bại');
      throw err;
    }
  }

  async function toggleEnabled(next: boolean) {
    try {
      await upsertMut.mutateAsync({ ...buildPayload(), enabled: next });
      setEnabled(next);
      toast.success(next ? 'Đã bật gửi tự động' : 'Đã tắt gửi');
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Đổi trạng thái thất bại');
    }
  }

  /** Thêm 1 trường động lên khung — đặt giữa, font VN-safe, màu tối (khung thường sáng). */
  function addField(token: string) {
    const fontSize = Math.max(24, Math.round(canvasH * 0.028));
    const x = Math.round(canvasW * 0.12);
    setLayers((prev) => [
      ...prev,
      {
        text: token,
        x,
        y: Math.round(canvasH * 0.45),
        width: Math.round(canvasW * 0.5),
        fontSize,
        color: '#1f2937',
        textAlign: 'left',
        fontFamily: 'Be Vietnam Pro',
        fontWeight: '700',
      },
    ]);
  }

  // LIVE preview (debounce) — render phôi chưa lưu.
  async function refreshPreview() {
    try {
      setPreviewing(true);
      const src = await previewDraft(raceId, {
        template: buildTemplate(),
        raceName,
        staticFields: { location, raceDay, distance, passportPrefix },
      });
      setPreviewSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return src;
      });
    } catch {
      /* giữ ảnh cũ */
    } finally {
      setPreviewing(false);
    }
  }
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void refreshPreview(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, layers, preserved, canvasW, canvasH, bgUrl, bgColor, location, raceDay, distance, passportPrefix, raceName]);

  // ── drag reposition + resize width ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; cx: number; cy: number; sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ index: number; cx: number; sw: number; sx: number } | null>(null);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

  // Kéo cả ô để di chuyển (X + Y) — mọi kiểu căn lề.
  function startDrag(e: React.PointerEvent, index: number) {
    e.preventDefault();
    const l = layers[index];
    dragRef.current = { index, cx: e.clientX, cy: e.clientY, sx: l.x, sy: l.y };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const dx = ((ev.clientX - d.cx) / rect.width) * canvasW;
      const dy = ((ev.clientY - d.cy) / rect.height) * canvasH;
      setLayers((prev) =>
        prev.map((l, j) =>
          j === d.index
            ? { ...l, x: clamp(d.sx + dx, 0, canvasW), y: clamp(d.sy + dy, 0, canvasH) }
            : l,
        ),
      );
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Kéo mép phải để chỉnh ĐỘ DÀI (width) của ô chữ.
  function startResize(e: React.PointerEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const l = layers[index];
    resizeRef.current = { index, cx: e.clientX, sw: l.width, sx: l.x };
    const onMove = (ev: PointerEvent) => {
      const d = resizeRef.current;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const dx = ((ev.clientX - d.cx) / rect.width) * canvasW;
      const nw = clamp(d.sw + dx, 20, canvasW - d.sx);
      setLayers((prev) => prev.map((l, j) => (j === d.index ? { ...l, width: nw } : l)));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function tokenLabel(text: string): string {
    for (const [k, v] of Object.entries(TOKEN_LABELS)) if (text.includes(k)) return v;
    return text.slice(0, 16) || 'Chữ';
  }

  function updateLayer(i: number, patch: Partial<TextLayerDraft>) {
    setLayers((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function onBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBibPassImage(file);
      setBgUrl(url);
      const dims = await readImageDims(url);
      if (dims && dims.w > 0 && dims.h > 0) {
        setCanvasW(dims.w);
        setCanvasH(dims.h);
        toast.success(`Đã tải khung — canvas khớp ${dims.w}×${dims.h}px`);
      } else {
        toast.success('Đã tải khung');
      }
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Tải ảnh thất bại');
    } finally {
      setUploading(false);
    }
  }

  async function doTestSend() {
    if (!testEmail.trim()) return;
    try {
      await saveAll(); // lưu trước để test đúng cấu hình hiện tại
      const res = await testMut.mutateAsync({ toEmail: testEmail.trim() });
      if (res.ok) toast.success(res.message);
      else toast.warning(res.message);
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Gửi thử thất bại');
    }
  }

  async function doResend(athletesId: number) {
    setResendingId(athletesId);
    try {
      const res = await resendMut.mutateAsync(athletesId);
      if (res.ok) toast.success(res.message);
      else toast.warning(res.message);
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Gửi lại thất bại');
    } finally {
      setResendingId(null);
    }
  }

  async function doSendBatch() {
    try {
      const res = await sendMut.mutateAsync();
      if (res.dryRun) {
        toast.warning(
          `DRY-RUN (kill-switch BIB_PASS_SEND_ENABLED=false): sẽ gửi ${res.attempted} VĐV — chưa gửi thật.`,
        );
      } else {
        toast.success(
          `Đã xử lý ${res.attempted}: gửi ${res.sent}, lỗi ${res.failed}, bỏ qua ${res.skipped}.${res.hasMore ? ' Còn nữa — bấm lại để gửi tiếp.' : ''}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof BibPassApiError ? err.message : 'Gửi thất bại');
    }
  }

  if (isLoading && !isError) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  const fontList = fonts ?? [{ family: 'Be Vietnam Pro', label: 'Be Vietnam Pro', category: 'sans' }];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/bib-pass')} className="text-xs text-muted-foreground hover:underline">
            ← Danh sách
          </button>
          <h1 className="text-2xl font-bold">{raceName || `Giải #${raceId}`}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            race #{raceId}
            {raceOption ? ` · ${raceOption.confirmedCount} VĐV đã xác nhận BIB` : ''}
          </p>
        </div>
        <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'Đang gửi' : 'Đang tắt'}</Badge>
      </div>

      <Tabs defaultValue="template">
        <TabsList>
          <TabsTrigger value="template">Khung & Trường</TabsTrigger>
          <TabsTrigger value="content">Thông tin & Email</TabsTrigger>
          <TabsTrigger value="send">Kích hoạt & Gửi</TabsTrigger>
        </TabsList>

        {/* ── Khung + trường động ── */}
        <TabsContent value="template">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4 p-6">
              {/* 1. Tải khung */}
              <div className="space-y-1.5">
                <Label>1. Ảnh khung Border Pass (thiết kế sẵn)</Label>
                <input type="file" accept="image/*" onChange={onBgFile} />
                <p className="text-xs text-muted-foreground">
                  Tải ảnh khung đã thiết kế hoàn chỉnh — canvas tự khớp kích thước ảnh. Sau đó đặt
                  các trường động (Họ tên, Số BIB…) lên đúng vị trí.
                </p>
                {uploading && <p className="text-xs text-muted-foreground">Đang tải…</p>}
                {bgUrl ? (
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-xs text-muted-foreground" title={bgUrl}>
                      {canvasW}×{canvasH}px · {bgUrl.split('/').pop()}
                    </p>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setBgUrl('')}>Bỏ khung</Button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Rộng</Label>
                      <Input type="number" value={canvasW} onChange={(e) => setCanvasW(Number(e.target.value))} className="h-8 w-24" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cao</Label>
                      <Input type="number" value={canvasH} onChange={(e) => setCanvasH(Number(e.target.value))} className="h-8 w-24" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Màu nền</Label>
                      <Input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-8 w-14 p-1" />
                    </div>
                  </div>
                )}
              </div>

              {/* Round-trip: config cũ có shape → cho xoá (flow mới không tạo shape) */}
              {preserved.length > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3 text-xs">
                  <span className="text-muted-foreground">Phôi này có <b>{preserved.length} khối nền</b> cũ.</span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setPreserved([]); toast.success('Đã xoá khối nền'); }}>
                    Xoá khối nền
                  </Button>
                </div>
              )}

              {/* 2. Thêm trường động */}
              <div className="space-y-2 border-t pt-4">
                <Label>2. Thêm trường động lên khung</Label>
                <div className="flex flex-wrap gap-2">
                  {FIELD_PALETTE.map((f) => (
                    <Button key={f.token} size="sm" variant="outline" onClick={() => addField(f.token)}>
                      + {f.label}
                    </Button>
                  ))}
                </div>
                {layers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Chưa có trường nào. Bấm nút trên để thêm — rồi kéo vào đúng ô trên khung.
                  </p>
                )}
              </div>

              {/* 3. Danh sách trường */}
              {layers.map((l, i) => (
                <div key={i} className="space-y-2 rounded border p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0 font-normal">{tokenLabel(l.text)}</Badge>
                    <Input value={l.text} onChange={(e) => updateLayer(i, { text: e.target.value })} placeholder="{name}" />
                  </div>
                  <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-5">
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
                    <div className="col-span-3">
                      <Label className="text-xs">Đậm</Label>
                      <select
                        className="h-9 w-full rounded border bg-background px-1 text-sm"
                        value={l.fontWeight}
                        onChange={(e) => updateLayer(i, { fontWeight: e.target.value })}
                      >
                        <option value="400">Thường</option>
                        <option value="600">Vừa</option>
                        <option value="700">Đậm</option>
                        <option value="900">Rất đậm</option>
                      </select>
                    </div>
                    <NumberField label="Cỡ" value={l.fontSize} onChange={(v) => updateLayer(i, { fontSize: v })} span={2} />
                    <div className="col-span-2">
                      <Label className="text-xs">Màu</Label>
                      <Input type="color" value={l.color} onChange={(e) => updateLayer(i, { color: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-end gap-2">
                    <NumberField label="X" value={l.x} onChange={(v) => updateLayer(i, { x: v })} span={2} />
                    <NumberField label="Y" value={l.y} onChange={(v) => updateLayer(i, { y: v })} span={2} />
                    <NumberField label="Rộng" value={l.width} onChange={(v) => updateLayer(i, { width: Math.max(20, v) })} span={2} />
                    <div className="col-span-4">
                      <Label className="text-xs">Căn (trong ô rộng)</Label>
                      <select
                        className="h-9 w-full rounded border bg-background px-1 text-sm"
                        value={l.textAlign}
                        onChange={(e) => updateLayer(i, { textAlign: e.target.value as TextLayerDraft['textAlign'] })}
                      >
                        <option value="left">Trái</option>
                        <option value="center">Giữa</option>
                        <option value="right">Phải</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setLayers(layers.filter((_, j) => j !== i))}>Xoá</Button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3 border-t pt-4">
                <Button onClick={() => void saveAll()} disabled={upsertMut.isPending}>
                  {upsertMut.isPending ? 'Đang lưu…' : 'Lưu phôi'}
                </Button>
                <span className="text-xs text-muted-foreground">Xem trước tự cập nhật bên phải.</span>
              </div>
            </Card>

            <Card className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <Label>Xem trước (dữ liệu mẫu)</Label>
                {previewing && <span className="text-xs text-muted-foreground">Đang render…</span>}
              </div>
              {previewSrc ? (
                <>
                  <div ref={wrapRef} className="relative mx-auto w-full max-w-md select-none touch-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewSrc} alt="preview Border Pass" className="block w-full rounded border" draggable={false} />
                    {layers.map((l, i) => {
                      const topPct = (l.y / canvasH) * 100;
                      const hPct = Math.max(2, ((l.fontSize * 1.4) / canvasH) * 100);
                      const leftPct = (l.x / canvasW) * 100;
                      const wPct = Math.max(3, (l.width / canvasW) * 100);
                      return (
                        <div
                          key={i}
                          onPointerDown={(e) => startDrag(e, i)}
                          title={`Kéo để di chuyển "${tokenLabel(l.text)}" · kéo mép phải để chỉnh độ dài`}
                          style={{ top: `${topPct}%`, left: `${leftPct}%`, width: `${wPct}%`, height: `${hPct}%` }}
                          className="group absolute flex cursor-move items-center justify-center rounded border border-dashed border-blue-500/80 bg-blue-500/10 hover:bg-blue-500/25"
                        >
                          <span className="pointer-events-none rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                            {tokenLabel(l.text)} ⠿
                          </span>
                          {/* grip kéo độ dài (mép phải) */}
                          <span
                            onPointerDown={(e) => startResize(e, i)}
                            title="Kéo để chỉnh độ dài ô chữ"
                            className="absolute -right-1 top-0 h-full w-2.5 cursor-ew-resize rounded-sm bg-blue-600/70 opacity-0 transition group-hover:opacity-100"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Kéo khung nét đứt vào đúng ô trên khung (chữ căn giữa kéo lên/xuống). Ưng → “Lưu phôi”.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {bgUrl ? 'Đang tải xem trước…' : 'Tải ảnh khung ở bên trái để bắt đầu.'}
                </p>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── Thông tin & Email ── */}
        <TabsContent value="content">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4 p-6">
              <h3 className="font-semibold">Thông tin động</h3>
              <div className="space-y-1.5">
                <Label>Tên giải (token {'{event_name}'})</Label>
                <Input value={raceName} onChange={(e) => setRaceName(e.target.value)} placeholder="Lào Cai Marathon 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Tiền tố Passport ({'{passport_no}'} = tiền tố + BIB)</Label>
                <Input value={passportPrefix} onChange={(e) => setPassportPrefix(e.target.value)} placeholder="LCM-2026-" />
              </div>
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Các trường dưới đây chỉ cần điền <b>nếu khung CHƯA in sẵn</b> (thường khung đã có).
                Dùng làm token {'{location}'} / {'{race_day}'} / {'{distance}'} nếu bạn thêm chúng lên khung.
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Địa điểm ({'{location}'})</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Quảng trường Tráng A Pao" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ngày thi ({'{race_day}'})</Label>
                  <Input value={raceDay} onChange={(e) => setRaceDay(e.target.value)} placeholder="18/10/2026" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cự ly ({'{distance}'})</Label>
                  <Input value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.5/10.5/21KM" />
                </div>
              </div>
            </Card>

            <Card className="space-y-4 p-6">
              <h3 className="font-semibold">Nội dung email</h3>
              <div className="space-y-1.5">
                <Label>Tên người gửi</Label>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="5BIB" />
              </div>
              <div className="space-y-1.5">
                <Label>Tiêu đề</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nội dung (HTML — token {'{name}'}/{'{bib}'}/{'{event_name}'})</Label>
                <Textarea rows={6} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} placeholder="<p>Chào {name}, đây là Border Pass của bạn…</p> (để trống = dùng mẫu mặc định)" />
              </div>
              <div className="space-y-1.5">
                <Label>Tên file đính kèm</Label>
                <Input value={attachmentFilename} onChange={(e) => setAttachmentFilename(e.target.value)} />
              </div>
              <Button onClick={() => void saveAll()} disabled={upsertMut.isPending}>
                {upsertMut.isPending ? 'Đang lưu…' : 'Lưu thông tin & email'}
              </Button>
            </Card>
          </div>
        </TabsContent>

        {/* ── Kích hoạt & Gửi ── */}
        <TabsContent value="send">
          <div className="space-y-6">
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={(v) => void toggleEnabled(v)} disabled={upsertMut.isPending} />
                <div>
                  <Label>Kích hoạt gửi tự động</Label>
                  <p className="text-xs text-muted-foreground">
                    Bật để cron tự quét VĐV mới xác nhận BIB & gửi pass. Cần đã lưu phôi + tiêu đề.
                  </p>
                </div>
              </div>
              {stats && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat label="Đã xác nhận" value={stats.confirmed} />
                  <Stat label="Đã gửi" value={stats.sent} tone="green" />
                  <Stat label="Còn lại" value={stats.pending} tone="orange" />
                  <Stat label="Lỗi" value={stats.failed} tone="red" />
                  <Stat label="Bỏ qua" value={stats.skipped} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="email-cua-ban@example.com"
                  className="max-w-xs"
                />
                <Button variant="outline" onClick={() => void doTestSend()} disabled={!testEmail.trim() || testMut.isPending}>
                  {testMut.isPending ? 'Đang gửi thử…' : 'Gửi thử'}
                </Button>
                <Button onClick={() => void doSendBatch()} disabled={sendMut.isPending}>
                  {sendMut.isPending ? 'Đang gửi…' : 'Gửi 1 đợt cho VĐV chưa gửi'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                “Gửi thử” lưu cấu hình hiện tại rồi gửi 1 email tới địa chỉ bạn nhập (không phải VĐV).
                “Gửi 1 đợt” gửi cho các VĐV đã xác nhận mà chưa từng nhận (chống trùng).
              </p>
            </Card>

            <Card className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <Label>VĐV đã xác nhận BIB</Label>
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Tìm tên / BIB"
                  className="max-w-xs"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BIB</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Trạng thái gửi</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(confirmed?.items ?? []).map((r) => (
                    <TableRow key={r.athletesId}>
                      <TableCell className="font-mono">{r.bib}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.hasEmail ? r.email : <span className="text-destructive">thiếu email</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={r.sendStatus} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.hasEmail || resendingId === r.athletesId}
                          onClick={() => void doResend(r.athletesId)}
                        >
                          {resendingId === r.athletesId ? 'Đang gửi…' : 'Gửi lại'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(confirmed?.items ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Chưa có VĐV khớp.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {confirmed && confirmed.total > confirmed.pageSize && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Trang {confirmed.page} · tổng {confirmed.total}
                  </span>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
                    <Button size="sm" variant="outline" disabled={page * confirmed.pageSize >= confirmed.total} onClick={() => setPage((p) => p + 1)}>Sau</Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NumberField({ label, value, onChange, span = 2 }: { label: string; value: number; onChange: (v: number) => void; span?: number }) {
  return (
    <div style={{ gridColumn: `span ${span} / span ${span}` }}>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'orange' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'orange' ? 'text-orange-600' : tone === 'red' ? 'text-destructive' : '';
  return (
    <div className="rounded border p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent') return <Badge variant="default">Đã gửi</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Lỗi</Badge>;
  if (status === 'skipped') return <Badge variant="secondary">Bỏ qua</Badge>;
  return <Badge variant="outline">Chưa gửi</Badge>;
}
