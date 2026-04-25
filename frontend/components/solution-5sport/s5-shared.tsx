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

/**
 * 5Sport logo mark — inline SVG extracted from official brand asset.
 * viewBox cropped to icon content bounds (from 1200×1200 source).
 * invert=true → white mark (for dark/hero backgrounds)
 * invert=false → brand colors (lime dot + blue "5")
 */
export function S5Logo({ size = 36, invert = false }: { size?: number; invert?: boolean }) {
  const mark = invert ? '#ffffff' : '#002ca8';
  const lime = '#aecc02';
  // aspect ratio ≈ 1.22:1 (width:height) for the icon crop
  const w = Math.round(size * 1.22);
  return (
    <svg
      viewBox="270 400 635 520"
      width={w}
      height={size}
      aria-label="5Sport"
      role="img"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* lime accent dot */}
      <path
        fill={lime}
        d="M818.34,418.88c29.82-3.01,51.13,16.85,47.59,44.36-3.54,27.5-30.59,52.24-60.42,55.24-29.82,3.01-51.13-16.85-47.59-44.36,3.54-27.5,30.59-52.24,60.42-55.24Z"
      />
      {/* tiny corner detail */}
      <path
        fill={mark}
        d="M374.29,808.72c-1.42-.7-2.76-1.47-4.02-2.33,1.27.84,2.61,1.61,4.02,2.33Z"
      />
      {/* upper-right S-curve of the 5 */}
      <path
        fill={mark}
        d="M862.02,606.83c22.45,30.29,29.99,68.26,24.33,106.94-7.32,50.53-37.17,102.25-85.64,139.72-39.28,30.34-85.09,46.75-128.99,46.75-3.53,0-7.05-.1-10.55-.35-4.89-.27-9.76-.79-14.6-1.51-39.08-5.86-72.35-22.52-86.11-43.15,26.59-19.32,44.12-41.59,53.28-55.1,5.12-7.57,7.62-12.39,7.62-12.41,11.87,16.61,28.38,23.27,38.11,24.73.17.02.35.05.52.07,27.26,3.9,59.94-6.46,87.57-27.81,33.1-25.57,53.23-62.6,54-93.04.3-12.59-2.66-24.04-9.39-33.12-.42-.57-.84-1.14-1.29-1.69-12.04-15.37-26.27-22.17-45.69-31.43-17.88-8.52-38.88-18.55-59.19-36.82-7.85-7.03-15.57-15.32-22.97-25.2-.07-.1-.17-.22-.25-.32-46.51-62.35-21.55-161.57,55.57-221.18,11.37-8.79,23.34-16.29,35.66-22.42,33.64-16.76,69.87-23.36,103.54-18.3,18.42,2.76,35.41,9.04,50.13,18.3,8.74,5.49,16.66,12.07,23.66,19.57l-61.78,61.38c-5.46-7.15-13.86-11.65-24.95-13.31-20.51-3.08-45.19,4.07-67.24,19.27-1.99,1.37-3.95,2.81-5.88,4.3-20.14,15.57-33.64,34.79-40.37,52.86-7.13,19.04-6.7,36.8,1.34,47.6,13.78,18.52,29.03,25.77,50.13,35.83,24.16,11.52,54.23,25.87,79.41,59.86Z"
      />
      {/* main body of the 5 + cross-bar */}
      <path
        fill={mark}
        d="M620.68,533.85c29.13,41.27,37.77,94.78,24.33,150.72h-.02c-7.4,30.96-21.75,62.3-41.49,90.65l-2.86,3.97c-17.43,24.16-38.46,45.79-62.55,64.41-15.17,11.74-31.26,22-47.82,30.49-.4.22-.79.42-1.19.62-19.54,9.98-39.93,17.63-60.49,22.64l-2.78.6s-.12.02-.17.02c-2.43.42-4.84.79-7.25,1.09-2.41.32-4.79.57-7.18.79-4.77.42-9.48.62-14.13.62-43.95,0-82.29-18.37-105.85-51.75-45.26-64.13-20.56-160.9,56.24-220.26,42.46-32.78,93.16-47.62,139.17-40.72,18.75,2.83,39,13.43,47.36,29.04,9.65,18.03,17.54,60.45-30,106.34,2.23-16.96-.35-27.76-5.04-35.06-5.61-8.76-13.68-12.61-25.25-14.35-22.32-3.35-49.66,5.44-73.07,23.54-41.94,32.4-53.88,79.43-38.39,101.38.84,1.19,1.79,2.33,2.83,3.4.5.55,1.04,1.07,1.59,1.56,1.14,1.02,2.33,1.94,3.6,2.78,1.27.87,2.61,1.64,4.02,2.33h.02c7.1,3.53,15.99,5.16,25.95,4.77.75-.02,1.49-.07,2.23-.12,1.49-.1,3.03-.25,4.57-.45.77-.1,1.54-.22,2.33-.35t.05,0c13.53-3.43,27.04-8.57,40.15-15.27,12.24-6.23,24.11-13.76,35.36-22.45,17.48-13.51,32.68-29.13,45.17-46.43l2.23-3.13c13.53-19.47,23.24-40.55,28.13-60.98,0,0,2.41-11.57,3-17.16.67-5.93.89-11.72.67-17.33-.67-17.5-5.56-33.2-14.5-45.86-23.96-33.97-74.99-43.03-130.01-23.09l-80.7,29.22,79.58-270.62h282.17l-87.45,86.9h-129.69l-16.83,57.26c63.56-2.46,119.98,22.07,153.94,70.22Z"
      />
      {/* bottom-left fill detail */}
      <path
        fill={mark}
        d="M490.27,874.1c-20.63,11.99-42.31,20.01-64.46,23.86l2.78-.6c20.56-5.02,40.94-12.66,60.49-22.64.4-.2.79-.4,1.19-.62Z"
      />
      {/* hairline stroke detail */}
      <line
        stroke={mark}
        strokeWidth={35}
        strokeMiterlimit={10}
        fill="none"
        x1="404.87" y1="520.01"
        x2="404.72" y2="520.5"
      />
    </svg>
  );
}

/** IntersectionObserver-based reveal — fade-up + slight scale once visible. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  as: Tag = 'div',
  style,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  as?: 'div' | 'section' | 'article' | 'span';
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setShown(true);
        io.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0) scale(1)' : `translateY(${y}px) scale(0.985)`,
        transition: `opacity 720ms var(--ease-out-expo) ${delay}ms, transform 720ms var(--ease-out-expo) ${delay}ms`,
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

/** 3D tilt card — tracks pointer and tilts on hover. Respects reduced motion. */
export function TiltCard({
  children,
  className,
  style,
  id,
  strength = 10,
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  strength?: number;
  glare?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const rafId = React.useRef<number | null>(null);
  const [glarePos, setGlarePos] = React.useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * strength;
    const ry = (px - 0.5) * strength;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      if (glare) setGlarePos({ x: px * 100, y: py * 100, active: true });
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
    setGlarePos((g) => ({ ...g, active: false }));
  };

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 260ms var(--ease-out-expo), box-shadow 260ms',
        ...style,
      }}
    >
      {children}
      {glare && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.35), transparent 42%)`,
            opacity: glarePos.active ? 1 : 0,
            transition: 'opacity 220ms var(--ease-out-expo)',
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </div>
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
