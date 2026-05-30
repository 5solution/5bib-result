// tutorial-effects.jsx — Fun effects: confetti, sparkles, ripples, page transitions.

const { Easing: efxEasing, clamp: efxClamp, useSprite: efxUseSprite } = window;

// ── Confetti burst ──────────────────────────────────────────────────────
function Confetti({ active, count = 90, originX = 960, originY = 540,
                    colors = ['#1D49FF','#FF0E65','#BEE14A','#D97706','#22C55E','#fff'],
                    t = 0, durationSec = 2.5 }) {
  if (!active) return null;
  const particles = React.useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 600 + Math.random() * 800;
      return {
        id: i,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 720,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 12,
        delay: Math.random() * 0.15,
      };
    });
  }, [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 200 }}>
      {particles.map(p => {
        const localT = Math.max(0, t - p.delay);
        const life = efxClamp(localT / durationSec, 0, 1);
        if (life >= 1) return null;
        const gravity = 1200;
        const x = originX + p.vx * localT;
        const y = originY + p.vy * localT + 0.5 * gravity * localT * localT;
        const rot = p.rot + p.vrot * localT;
        const op = 1 - Math.pow(life, 3);
        return (
          <div key={p.id} style={{
            position: 'absolute', left: x, top: y,
            width: p.w, height: p.h,
            background: p.color,
            transform: `rotate(${rot}deg)`,
            opacity: op,
            borderRadius: 2,
            willChange: 'transform, opacity',
          }} />
        );
      })}
    </div>
  );
}

// ── Sparkles around a point (used on tap success) ──────────────────────
function Sparkles({ x, y, active, t = 0, color = '#FF0E65' }) {
  if (!active) return null;
  const stars = React.useMemo(() => Array.from({ length: 8 }).map((_, i) => ({
    angle: (i / 8) * Math.PI * 2,
    delay: i * 0.04,
  })), []);
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 150 }}>
      {stars.map((s, i) => {
        const localT = Math.max(0, t - s.delay);
        const life = efxClamp(localT / 0.6, 0, 1);
        if (life >= 1) return null;
        const distance = efxEasing.easeOutCubic(life) * 60;
        const dx = Math.cos(s.angle) * distance;
        const dy = Math.sin(s.angle) * distance;
        const scale = 1 - life;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: dx - 3, top: dy - 3,
            width: 6, height: 6,
            background: color,
            borderRadius: '50%',
            transform: `scale(${scale})`,
            opacity: 1 - life,
            boxShadow: `0 0 8px ${color}`,
          }} />
        );
      })}
      {/* center burst */}
      <div style={{
        position: 'absolute',
        left: -16, top: -16,
        width: 32, height: 32,
        border: `3px solid ${color}`,
        borderRadius: '50%',
        transform: `scale(${1 + t * 3})`,
        opacity: efxClamp(1 - t / 0.4, 0, 1),
      }} />
    </div>
  );
}

// ── Floating ambient particles (page background) ───────────────────────
function AmbientDots({ t = 0, count = 30, color = 'rgba(29,73,255,0.15)' }) {
  const dots = React.useMemo(() => Array.from({ length: count }).map((_, i) => ({
    x: Math.random() * 1920,
    y: Math.random() * 1080,
    size: 2 + Math.random() * 4,
    speed: 0.2 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
  })), [count]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {dots.map((d, i) => {
        const y = (d.y + t * 30 * d.speed) % 1080;
        const x = d.x + Math.sin(t * d.speed + d.phase) * 20;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: x, top: y,
            width: d.size, height: d.size,
            background: color,
            borderRadius: '50%',
            filter: 'blur(0.5px)',
          }} />
        );
      })}
    </div>
  );
}

// ── Animated count-up number ───────────────────────────────────────────
function CountUp({ to, t, dur = 1.0, style = {}, format = (v) => v.toLocaleString('vi-VN') }) {
  const p = efxClamp(t / dur, 0, 1);
  const eased = efxEasing.easeOutCubic(p);
  const value = Math.round(to * eased);
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{format(value)}</span>;
}

// ── Wipe transition (between scenes) ───────────────────────────────────
function WipeIn({ progress, color = 'var(--5s-blue)', direction = 'right' }) {
  // progress 0 → fully covers, 1 → uncovers
  const p = efxClamp(progress, 0, 1);
  const insetStyle = direction === 'right' ? `0 ${(1 - p) * 100}% 0 0`
                  : direction === 'left' ? `0 0 0 ${(1 - p) * 100}%`
                  : direction === 'up' ? `${(1 - p) * 100}% 0 0 0`
                  : `0 0 ${(1 - p) * 100}% 0`;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: color,
      clipPath: `inset(${insetStyle})`,
      pointerEvents: 'none',
      zIndex: 90,
    }} />
  );
}

// ── Sticky tag/badge "wobble" — extra liveliness on labels ─────────────
function Wobble({ t, children, freq = 1.5, amp = 2, style = {} }) {
  return (
    <span style={{
      display: 'inline-block',
      transform: `rotate(${Math.sin(t * freq) * amp}deg)`,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Big pulsing ring around an element (used to draw attention) ────────
function AttentionPulse({ x, y, w, h, t, color = '#FF0E65' }) {
  const phase = (t % 1.2) / 1.2;
  const ringScale = 1 + phase * 0.3;
  const ringOp = (1 - phase) * 0.85;
  return (
    <div style={{
      position: 'absolute',
      left: x - 12, top: y - 12,
      width: w + 24, height: h + 24,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        border: `3px solid ${color}`,
        borderRadius: 14,
        transform: `scale(${ringScale})`,
        opacity: ringOp,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        border: `2px solid ${color}`,
        borderRadius: 14,
        opacity: 0.85,
      }} />
    </div>
  );
}

// ── Slide-in screen wrapper (fresh page entrance) ──────────────────────
function SlideInPage({ t, dur = 0.5, direction = 'right', children }) {
  const p = efxClamp(t / dur, 0, 1);
  const eased = efxEasing.easeOutExpo(p);
  const translate = direction === 'right' ? `${(1 - eased) * 120}px, 0`
                  : direction === 'left' ? `${-(1 - eased) * 120}px, 0`
                  : direction === 'up' ? `0, ${-(1 - eased) * 60}px`
                  : `0, ${(1 - eased) * 60}px`;
  return (
    <div style={{
      width: '100%', height: '100%',
      transform: `translate(${translate})`,
      opacity: eased,
      willChange: 'transform, opacity',
    }}>{children}</div>
  );
}

window.Confetti = Confetti;
window.Sparkles = Sparkles;
window.AmbientDots = AmbientDots;
window.CountUp = CountUp;
window.WipeIn = WipeIn;
window.Wobble = Wobble;
window.AttentionPulse = AttentionPulse;
window.SlideInPage = SlideInPage;
