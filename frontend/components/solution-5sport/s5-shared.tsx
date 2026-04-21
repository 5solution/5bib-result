'use client';

import * as React from 'react';

export type Lang = 'vi' | 'en';

export function useT(lang: Lang) {
  return React.useCallback((vi: string, en: string) => (lang === 'en' ? en : vi), [lang]);
}

type IconProps = { s?: number; sw?: number; className?: string; style?: React.CSSProperties };

const Ic = ({ d, s = 18, sw = 2, className, style }: IconProps & { d: React.ReactNode }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {d}
  </svg>
);

export const IArr = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>} />;
export const ICheck = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<path d="M20 6 9 17l-5-5" />} />;
export const IX = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>} />;
export const IPlus = (p: IconProps) => <Ic {...p} s={p.s ?? 14} d={<><path d="M12 5v14" /><path d="M5 12h14" /></>} />;
export const IStar = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />} />;
export const ITrophy = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><path d="M6 9H4a2 2 0 0 1-2-2V5h4" /><path d="M18 9h2a2 2 0 0 0 2-2V5h-4" /><path d="M6 3h12v6a6 6 0 0 1-12 0V3z" /><path d="M9 21h6" /><path d="M12 15v6" /></>} />;
export const IUsers = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
export const ITicket = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 11v2M13 17v2" /></>} />;
export const IBolt = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />} />;
export const IPin = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><path d="M20 10c0 7-8 13-8 13S4 17 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>} />;
export const IShield = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />} />;
export const IChart = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>} />;
export const ICal = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />;
export const IMail = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>} />;
export const IPhone = (p: IconProps) => <Ic {...p} s={p.s ?? 16} d={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.92z" />} />;
export const IQr = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v7M14 20h3" /></>} />;
export const ICamera = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="4" /></>} />;
export const IShare = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" /></>} />;
export const IMoney = (p: IconProps) => <Ic {...p} s={p.s ?? 18} d={<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>} />;

export function S5Logo({ size = 32, invert = false }: { size?: number; invert?: boolean }) {
  const blue = invert ? '#C8FF00' : '#1400FF';
  const dark = invert ? '#ffffff' : '#0A0D2E';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, lineHeight: 1 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect x="2" y="2" width="44" height="44" rx="10" fill={blue} />
        <path d="M17 14h15M17 14v8h10a5 5 0 0 1 0 10H17" stroke="#C8FF00" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round" fill="none"
              style={invert ? { stroke: '#1400FF' } : undefined} />
        <circle cx="35.5" cy="33.5" r="3.5" fill="#C8FF00" style={invert ? { fill: '#1400FF' } : undefined} />
      </svg>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
        <strong style={{
          fontFamily: 'var(--font-display-5s)',
          fontWeight: 900,
          fontSize: size * 0.55,
          letterSpacing: '-0.02em',
          color: dark,
          textTransform: 'uppercase',
        }}>
          5<span style={{ color: blue }}>SPORT</span>
        </strong>
        <span style={{
          fontFamily: 'var(--font-body-5s)',
          fontWeight: 700,
          fontSize: size * 0.26,
          letterSpacing: '.12em',
          color: invert ? 'rgba(255,255,255,0.6)' : 'var(--s5-text-muted)',
          textTransform: 'uppercase',
        }}>
          Level Up Your Game
        </span>
      </span>
    </span>
  );
}

export function Pill({
  children,
  bg = 'rgba(255,255,255,0.1)',
  color = '#fff',
  border,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  border?: string;
}) {
  return (
    <span className="s5-pill" style={{ background: bg, color, border }}>
      {children}
    </span>
  );
}

export function CountUpStat({ value, duration = 1200 }: { value: string; duration?: number }) {
  const { num, suffix } = React.useMemo(() => {
    const m = value.match(/^(\d+)(.*)/);
    return m ? { num: parseInt(m[1], 10), suffix: m[2] } : { num: 0, suffix: value };
  }, [value]);
  const [count, setCount] = React.useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);
  const started = React.useRef(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        setCount(Math.round((1 - Math.pow(1 - p, 3)) * num));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [num, duration]);
  return <span ref={ref}>{count}{suffix}</span>;
}

export function Section({
  id,
  dark = false,
  children,
  style,
}: {
  id?: string;
  dark?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      id={id}
      className={`s5-section ${dark ? 's5-dark' : ''}`}
      style={{
        padding: '120px 0 96px',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px' }}>{children}</div>
    </section>
  );
}
