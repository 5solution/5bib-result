'use client';

/**
 * FEATURE-083 — Per-section visual content forms (replaces the raw-JSON editor).
 * Each form is a controlled editor: it receives the section `data` object and
 * emits a new one via `onChange`. Field shapes mirror exactly what the public
 * renderer components read (frontend/components/landing/sections/*). Unknown
 * keys on `data` are preserved (spread), so auto-data flags like
 * `source: 'race_courses'` survive edits. A collapsible "JSON nâng cao" escape
 * hatch stays available for power users / fields not surfaced here.
 */

import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type Data = Record<string, unknown>;
type FormProps = { data: Data; onChange: (next: Data) => void };

/* ── helpers ─────────────────────────────────────────────────── */
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const numOr = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** ISO ↔ <input type=datetime-local> (`YYYY-MM-DDTHH:mm`, local time). */
function isoToLocal(iso: unknown): string {
  const s = str(iso);
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/* ── primitives ──────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text', mono }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? 'font-mono text-xs' : ''}
      />
    </div>
  );
}

function NumField({ label, value, onChange, placeholder }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </div>
  );
}

function AreaField({ label, value, onChange, rows = 3, hint }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function BoolField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

/** string[] edited one-per-line. */
function LinesField({ label, value, onChange, rows = 3, hint }: {
  label: string; value: string[]; onChange: (v: string[]) => void; rows?: number; hint?: string;
}) {
  return (
    <AreaField
      label={label}
      rows={rows}
      hint={hint ?? 'Mỗi dòng một mục.'}
      value={value.join('\n')}
      onChange={(t) => onChange(t.split('\n').map((x) => x.trim()).filter(Boolean))}
    />
  );
}

/** number[] edited as comma/space-separated. */
function NumListField({ label, value, onChange, hint }: {
  label: string; value: number[]; onChange: (v: number[]) => void; hint?: string;
}) {
  return (
    <AreaField
      label={label}
      rows={2}
      hint={hint ?? 'Các số cách nhau bởi dấu phẩy.'}
      value={value.join(', ')}
      onChange={(t) => onChange(t.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n)))}
    />
  );
}

function Repeater<T>({ label, items, onChange, blank, addLabel, render }: {
  label: string; items: T[]; onChange: (items: T[]) => void;
  blank: () => T; addLabel: string; render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, blank()])}>
          + {addLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded border border-dashed px-3 py-2 text-xs text-muted-foreground">Chưa có mục nào.</p>
      ) : null}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="relative rounded-lg border bg-muted/30 p-3">
            <div className="absolute right-2 top-2 flex gap-1">
              <button type="button" className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button type="button" className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
              <button type="button" className="px-1 text-xs text-destructive hover:underline"
                onClick={() => onChange(items.filter((_, k) => k !== i))}>Xoá</button>
            </div>
            <div className="grid gap-2 pr-16 sm:grid-cols-2">
              {render(item, (patch) =>
                onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it))),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── per-type forms ──────────────────────────────────────────── */
function useSet(data: Data, onChange: (d: Data) => void) {
  return (key: string, val: unknown) => onChange({ ...data, [key]: val });
}

type Cta = { label?: string; href?: string; style?: string };
function HeroForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  const ctas = arr(data.ctaButtons) as Cta[];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tiêu đề lớn" value={str(data.title)} onChange={(v) => set('title', v)} />
      <Field label="Phụ đề / kicker" value={str(data.subtitle)} onChange={(v) => set('subtitle', v)} />
      <Field label="Ảnh/Video nền (URL)" value={str(data.media)} onChange={(v) => set('media', v)} mono />
      <Field label="Ngày diễn ra (hiển thị)" value={str(data.date)} onChange={(v) => set('date', v)} placeholder="17 – 18/10/2026" />
      <Field label="Địa điểm" value={str(data.location)} onChange={(v) => set('location', v)} />
      <Field label="Cự ly (hiển thị)" value={str(data.distances)} onChange={(v) => set('distances', v)} placeholder="5.5K · 10.5K · 21K" />
      <Field label="Đếm ngược tới" type="datetime-local" value={isoToLocal(data.countdownTo)} onChange={(v) => set('countdownTo', localToIso(v))} />
      <NumField label="Độ tối overlay (0–0.8)" value={typeof data.overlay === 'number' ? data.overlay : undefined} onChange={(v) => set('overlay', v)} placeholder="0.55" />
      <div className="sm:col-span-2">
        <Repeater<Cta> label="Nút CTA" items={ctas} onChange={(v) => set('ctaButtons', v)} addLabel="Thêm nút" blank={() => ({ label: '', href: '', style: 'primary' })}
          render={(c, u) => (<>
            <Field label="Nhãn nút" value={str(c.label)} onChange={(v) => u({ label: v })} />
            <Field label="Liên kết (href)" value={str(c.href)} onChange={(v) => u({ href: v })} mono />
            <div className="space-y-1">
              <Label className="text-xs">Kiểu</Label>
              <select value={str(c.style) || 'primary'} onChange={(e) => u({ style: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="primary">Chính (nổi bật)</option>
                <option value="ghost">Phụ (viền)</option>
              </select>
            </div>
          </>)} />
      </div>
    </div>
  );
}

type Stat = { num?: string; label?: string };
function AboutForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  const cta = (data.cta ?? {}) as { label?: string; href?: string };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tiêu đề" value={str(data.title)} onChange={(v) => set('title', v)} />
      <Field label="Nhãn góc ảnh" value={str(data.cornerBadge)} onChange={(v) => set('cornerBadge', v)} />
      <Field label="Ảnh (URL)" value={str(data.image)} onChange={(v) => set('image', v)} mono />
      <div className="sm:col-span-2">
        <LinesField label="Đoạn văn giới thiệu" value={(arr(data.paragraphs) as string[])} onChange={(v) => set('paragraphs', v)} rows={4} hint="Mỗi dòng = một đoạn." />
      </div>
      <Field label="Nhãn nút (CTA)" value={str(cta.label)} onChange={(v) => set('cta', { ...cta, label: v })} />
      <Field label="Liên kết nút" value={str(cta.href)} onChange={(v) => set('cta', { ...cta, href: v })} mono />
      <div className="sm:col-span-2">
        <Repeater<Stat> label="Số liệu nổi bật" items={arr(data.stats) as Stat[]} onChange={(v) => set('stats', v)} addLabel="Thêm số liệu" blank={() => ({ num: '', label: '' })}
          render={(s, u) => (<>
            <Field label="Con số" value={str(s.num)} onChange={(v) => u({ num: v })} placeholder="21KM" />
            <Field label="Nhãn" value={str(s.label)} onChange={(v) => u({ label: v })} placeholder="Cự ly dài nhất" />
          </>)} />
      </div>
    </div>
  );
}

type Course = { key?: string; label?: string; terrainLabel?: string; dist?: string; gain?: number; aid?: number; cutoff?: string; terrain?: string; elevation?: number[] };
function CourseForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tiêu đề" value={str(data.title)} onChange={(v) => set('title', v)} />
        <Field label="Kicker" value={str(data.kicker)} onChange={(v) => set('kicker', v)} placeholder="Cung đường · Courses" />
      </div>
      <AreaField label="Mô tả ngắn (lead)" value={str(data.lead)} onChange={(v) => set('lead', v)} rows={2} />
      <Repeater<Course> label="Các cự ly" items={arr(data.courses) as Course[]} onChange={(v) => set('courses', v)} addLabel="Thêm cự ly"
        blank={() => ({ key: '', label: '', dist: '', gain: 0, aid: 0, cutoff: '', terrain: '', elevation: [] })}
        render={(c, u) => (<>
          <Field label="Mã (key, duy nhất)" value={str(c.key)} onChange={(v) => u({ key: v })} placeholder="21k" />
          <Field label="Tên hiển thị" value={str(c.label)} onChange={(v) => u({ label: v })} placeholder="21 KM" />
          <Field label="Nhãn phụ (tab)" value={str(c.terrainLabel)} onChange={(v) => u({ terrainLabel: v })} placeholder="Half Marathon" />
          <Field label="Cự ly (km)" value={str(c.dist)} onChange={(v) => u({ dist: v })} placeholder="21" />
          <NumField label="Tích lũy D+ (m)" value={c.gain} onChange={(v) => u({ gain: v })} />
          <NumField label="Số trạm tiếp nước" value={c.aid} onChange={(v) => u({ aid: v })} />
          <Field label="Cut-off" value={str(c.cutoff)} onChange={(v) => u({ cutoff: v })} placeholder="4h00" />
          <Field label="Địa hình" value={str(c.terrain)} onChange={(v) => u({ terrain: v })} placeholder="Road · Đồi biên giới" />
          <div className="sm:col-span-2">
            <NumListField label="Biểu đồ độ cao (mốc)" value={(c.elevation ?? []) as number[]} onChange={(v) => u({ elevation: v })} hint="Các số độ cao, cách nhau bởi dấu phẩy — vẽ biểu đồ elevation." />
          </div>
        </>)} />
    </div>
  );
}

type SItem = { day?: string; time?: string; title?: string; location?: string; key?: boolean };
function ScheduleForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tiêu đề" value={str(data.heading)} onChange={(v) => set('heading', v)} placeholder="Cuối tuần đua" />
        <Field label="Kicker" value={str(data.kicker)} onChange={(v) => set('kicker', v)} placeholder="Lịch trình" />
      </div>
      <AreaField label="Mô tả ngắn (lead)" value={str(data.lead)} onChange={(v) => set('lead', v)} rows={2} />
      <Repeater<SItem> label="Mốc lịch trình (Timeline)" items={arr(data.items) as SItem[]} onChange={(v) => set('items', v)} addLabel="Thêm mốc"
        blank={() => ({ day: '', time: '', title: '', location: '', key: false })}
        render={(it, u) => (<>
          <Field label="Ngày (nhóm)" value={str(it.day)} onChange={(v) => u({ day: v })} placeholder="Chủ nhật · 18/10/2026" />
          <Field label="Giờ" value={str(it.time)} onChange={(v) => u({ time: v })} placeholder="05:00" />
          <Field label="Nội dung" value={str(it.title)} onChange={(v) => u({ title: v })} placeholder="Xuất phát 21KM" />
          <Field label="Địa điểm" value={str(it.location)} onChange={(v) => u({ location: v })} />
          <div className="sm:col-span-2"><BoolField label="Mốc quan trọng (nhấn mạnh)" checked={!!it.key} onChange={(v) => u({ key: v })} /></div>
        </>)} />
      <div className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">Kiểu <b>Ảnh</b>: dùng các ô dưới thay cho timeline.</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ảnh lịch trình (URL)" value={str(data.image)} onChange={(v) => set('image', v)} mono />
        <Field label="Ghi chú ảnh" value={str(data.imageNote)} onChange={(v) => set('imageNote', v)} />
      </div>
    </div>
  );
}

type Tier = { name?: string; sub?: string; price?: number; compareAtPrice?: number; earlyBirdLabel?: string; includes?: string[]; cta?: { label?: string; href?: string }; featured?: boolean };
function PricingForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tiêu đề" value={str(data.title)} onChange={(v) => set('title', v)} placeholder="Chọn cự ly của bạn" />
        <Field label="Kicker" value={str(data.kicker)} onChange={(v) => set('kicker', v)} placeholder="Vé · Đăng ký" />
      </div>
      <AreaField label="Mô tả ngắn (lead)" value={str(data.lead)} onChange={(v) => set('lead', v)} rows={2} />
      <Field label="Ghi chú dưới bảng giá" value={str(data.note)} onChange={(v) => set('note', v)} />
      <Repeater<Tier> label="Hạng vé" items={arr(data.tiers) as Tier[]} onChange={(v) => set('tiers', v)} addLabel="Thêm hạng vé"
        blank={() => ({ name: '', sub: '', price: undefined, compareAtPrice: undefined, includes: [], cta: { label: 'Đăng ký', href: '' }, featured: false })}
        render={(t, u) => (<>
          <Field label="Tên (cự ly)" value={str(t.name)} onChange={(v) => u({ name: v })} placeholder="21 KM" />
          <Field label="Phụ đề" value={str(t.sub)} onChange={(v) => u({ sub: v })} placeholder="Half Marathon" />
          <NumField label="Giá (VNĐ)" value={t.price} onChange={(v) => u({ price: v })} placeholder="500000" />
          <NumField label="Giá gốc (gạch ngang)" value={t.compareAtPrice} onChange={(v) => u({ compareAtPrice: v })} placeholder="850000" />
          <Field label="Nhãn ưu đãi" value={str(t.earlyBirdLabel)} onChange={(v) => u({ earlyBirdLabel: v })} placeholder="Super Early Bird · đến 15/06" />
          <div className="flex items-end"><BoolField label="Nổi bật (Phổ biến nhất)" checked={!!t.featured} onChange={(v) => u({ featured: v })} /></div>
          <Field label="Nhãn nút" value={str(t.cta?.label)} onChange={(v) => u({ cta: { ...(t.cta ?? {}), label: v } })} placeholder="Đăng ký" />
          <Field label="Liên kết nút (5bib.com)" value={str(t.cta?.href)} onChange={(v) => u({ cta: { ...(t.cta ?? {}), href: v } })} mono />
          <div className="sm:col-span-2"><LinesField label="Bao gồm" value={(t.includes ?? []) as string[]} onChange={(v) => u({ includes: v })} rows={3} /></div>
        </>)} />
    </div>
  );
}

type Row = { rank?: number; name?: string; cat?: string; bib?: string; chip?: string; pace?: string };
function ResultsForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Link kết quả" value={str(data.resultUrl)} onChange={(v) => set('resultUrl', v)} mono placeholder="https://result.5bib.com" />
        <Field label="Nhãn cự ly hiển thị" value={str(data.courseLabel)} onChange={(v) => set('courseLabel', v)} placeholder="21KM · Chung cuộc" />
      </div>
      <p className="text-[11px] text-muted-foreground">Để trống bảng dưới khi giải chưa diễn ra — section vẫn hiển thị khung &ldquo;LIVE&rdquo; + link result.5bib.com.</p>
      <Repeater<Row> label="Bảng xếp hạng (tuỳ chọn)" items={arr(data.rows) as Row[]} onChange={(v) => set('rows', v)} addLabel="Thêm dòng"
        blank={() => ({ rank: undefined, name: '', bib: '', chip: '', pace: '', cat: '' })}
        render={(r, u) => (<>
          <NumField label="Hạng" value={r.rank} onChange={(v) => u({ rank: v })} />
          <Field label="VĐV" value={str(r.name)} onChange={(v) => u({ name: v })} />
          <Field label="BIB" value={str(r.bib)} onChange={(v) => u({ bib: v })} />
          <Field label="Chip time" value={str(r.chip)} onChange={(v) => u({ chip: v })} />
          <Field label="Pace" value={str(r.pace)} onChange={(v) => u({ pace: v })} />
          <Field label="Hạng mục" value={str(r.cat)} onChange={(v) => u({ cat: v })} />
        </>)} />
    </div>
  );
}

function PhotosForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <div className="grid gap-3">
      <Field label="Link album 5pix (pixEventUrl)" value={str(data.pixEventUrl)} onChange={(v) => set('pixEventUrl', v)} mono placeholder="https://5pix.org/..." />
      <LinesField label="Ảnh mẫu (URL — tuỳ chọn)" value={(arr(data.sampleImages) as string[])} onChange={(v) => set('sampleImages', v)} rows={3} hint="Mỗi dòng một URL ảnh mẫu hiển thị trước khi sang 5pix." />
    </div>
  );
}

type GItem = { url?: string; type?: string; caption?: string };
function GalleryForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <Repeater<GItem> label="Ảnh / Video" items={arr(data.items) as GItem[]} onChange={(v) => set('items', v)} addLabel="Thêm ảnh"
      blank={() => ({ url: '', type: 'image', caption: '' })}
      render={(it, u) => (<>
        <Field label="URL ảnh/video" value={str(it.url)} onChange={(v) => u({ url: v })} mono />
        <Field label="Chú thích" value={str(it.caption)} onChange={(v) => u({ caption: v })} />
        <div className="space-y-1">
          <Label className="text-xs">Loại</Label>
          <select value={str(it.type) || 'image'} onChange={(e) => u({ type: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="image">Ảnh</option>
            <option value="video">Video</option>
          </select>
        </div>
      </>)} />
  );
}

const TIER_OPTS = [
  { value: 'diamond', label: 'Kim cương' },
  { value: 'gold', label: 'Vàng' },
  { value: 'silver', label: 'Bạc' },
];
type Logo = { imageUrl?: string; name?: string; url?: string };
type SpTier = { level?: string; logos?: Logo[] };
/** Edit sponsors as a flat logo list (each with a tier); store back as grouped tiers[]. */
function SponsorsForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  const tiers = arr(data.tiers) as SpTier[];
  const flat: (Logo & { level: string })[] = tiers.flatMap((t) =>
    arr(t.logos).map((l) => ({ ...(l as Logo), level: str(t.level) || 'silver' })),
  );
  const writeFlat = (rows: (Logo & { level: string })[]) => {
    const order = ['diamond', 'gold', 'silver'];
    const grouped: SpTier[] = order
      .map((lvl) => ({ level: lvl, logos: rows.filter((r) => r.level === lvl).map(({ imageUrl, name, url }) => ({ imageUrl, name, url })) }))
      .filter((t) => t.logos.length > 0);
    set('tiers', grouped);
  };
  return (
    <div className="grid gap-2">
      <p className="text-[11px] text-muted-foreground">Mặc định lấy tự động từ Nhà tài trợ của giải. Nhập tay dưới đây để ghi đè.</p>
      <Repeater<Logo & { level: string }> label="Logo nhà tài trợ" items={flat} onChange={writeFlat} addLabel="Thêm logo"
        blank={() => ({ imageUrl: '', name: '', url: '', level: 'silver' })}
        render={(l, u) => (<>
          <Field label="Logo (URL)" value={str(l.imageUrl)} onChange={(v) => u({ imageUrl: v })} mono />
          <Field label="Tên" value={str(l.name)} onChange={(v) => u({ name: v })} />
          <Field label="Website" value={str(l.url)} onChange={(v) => u({ url: v })} mono />
          <div className="space-y-1">
            <Label className="text-xs">Hạng tài trợ</Label>
            <select value={l.level} onChange={(e) => u({ level: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {TIER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </>)} />
    </div>
  );
}

type ContactSocial = { platform?: string; url?: string };
const PLATFORMS = ['facebook', 'instagram', 'youtube', 'strava'];
function ContactForm({ data, onChange }: FormProps) {
  const set = useSet(data, onChange);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Hotline" value={str(data.hotline)} onChange={(v) => set('hotline', v)} placeholder="0373 398 986" />
      <Field label="Email" value={str(data.email)} onChange={(v) => set('email', v)} />
      <div className="sm:col-span-2"><Field label="Địa chỉ" value={str(data.address)} onChange={(v) => set('address', v)} /></div>
      <Field label="Link Zalo OA" value={str(data.zaloUrl)} onChange={(v) => set('zaloUrl', v)} mono />
      <Field label="Tên Zalo OA" value={str(data.zaloOaName)} onChange={(v) => set('zaloOaName', v)} />
      <Field label="Link Fanpage" value={str(data.fbPageUrl)} onChange={(v) => set('fbPageUrl', v)} mono />
      <Field label="Nút CTA cuối (href)" value={str(data.finalCtaHref)} onChange={(v) => set('finalCtaHref', v)} mono placeholder="#pricing" />
      <div className="sm:col-span-2">
        <Repeater<ContactSocial> label="Mạng xã hội" items={arr(data.socials) as ContactSocial[]} onChange={(v) => set('socials', v)} addLabel="Thêm kênh"
          blank={() => ({ platform: 'facebook', url: '' })}
          render={(s, u) => (<>
            <div className="space-y-1">
              <Label className="text-xs">Nền tảng</Label>
              <select value={str(s.platform) || 'facebook'} onChange={(e) => u({ platform: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <Field label="Link" value={str(s.url)} onChange={(v) => u({ url: v })} mono />
          </>)} />
      </div>
    </div>
  );
}

/* ── dispatcher ──────────────────────────────────────────────── */
const FORMS: Record<string, (p: FormProps) => ReactElement> = {
  hero: HeroForm,
  about: AboutForm,
  course: CourseForm,
  schedule: ScheduleForm,
  pricing: PricingForm,
  results_embed: ResultsForm,
  photos_embed: PhotosForm,
  gallery: GalleryForm,
  sponsors: SponsorsForm,
  contact_social: ContactForm,
};

export default function SectionForm({ type, data, onChange }: { type: string; data: Data; onChange: (d: Data) => void }) {
  const [showJson, setShowJson] = useState(false);
  const [jsonErr, setJsonErr] = useState(false);
  const Form = FORMS[type];

  return (
    <div className="space-y-3">
      {Form ? <Form data={data} onChange={onChange} /> : (
        <p className="text-xs text-muted-foreground">Loại section này chưa có form trực quan — dùng JSON nâng cao bên dưới.</p>
      )}

      <details open={!Form} onToggle={(e) => setShowJson((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">JSON nâng cao</summary>
        {(showJson || !Form) && (
          <div className="mt-2">
            <Textarea
              defaultValue={JSON.stringify(data, null, 2)}
              rows={6}
              onChange={(e) => {
                try { onChange(JSON.parse(e.target.value) as Data); setJsonErr(false); }
                catch { setJsonErr(true); }
              }}
              className={`font-mono text-xs ${jsonErr ? 'border-destructive' : ''}`}
            />
            {jsonErr && <p className="mt-1 text-xs text-destructive">JSON không hợp lệ</p>}
          </div>
        )}
      </details>
    </div>
  );
}
