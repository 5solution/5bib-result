// Reusable UI building blocks for the 5BIB explainer.
// All take `t` (local time in seconds) so they can drive their own micro-animations.

const { useTime, useSprite, interpolate, animate, Easing, clamp } = window;

// ── Brand flood background with subtle topo lines + grain ───────────────────
function BrandFlood({ pushScale = 1 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--5s-blue)',
      overflow: 'hidden',
      transform: `scale(${pushScale})`,
      transformOrigin: 'center',
      willChange: 'transform',
    }}>
      {/* Radial topo-ish suggestion */}
      <div style={{
        position: 'absolute', inset: '-10%',
        background: 'radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.06), transparent 55%)',
      }} />
      <div style={{
        position: 'absolute', inset: '-10%',
        background: 'radial-gradient(ellipse at 80% 90%, rgba(255,14,101,0.12), transparent 50%)',
      }} />
      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: 0.06,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='3'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>")`,
      }} />
    </div>
  );
}

// ── The magenta "new" speech-bubble flag from the campaign asset ────────────
function NewBubble({ size = 1, style = {} }) {
  return (
    <div style={{
      position: 'relative',
      width: 220 * size, height: 130 * size,
      background: 'var(--5s-magenta)',
      borderRadius: 14 * size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 78 * size,
      letterSpacing: '-0.04em',
      ...style,
    }}>
      new
      {/* tail */}
      <div style={{
        position: 'absolute', right: -18 * size, bottom: 14 * size,
        width: 0, height: 0,
        borderLeft: `${48 * size}px solid var(--5s-magenta)`,
        borderTop: `${28 * size}px solid transparent`,
        borderBottom: `0 solid transparent`,
        transform: 'rotate(0deg)',
      }} />
    </div>
  );
}

// ── 5BIB logo glyph (vector-drawn approximation of the wordmark) ────────────
// Uses the actual png file for fidelity.
function BibLogo({ width = 200, white = false, style = {} }) {
  const src = white ? 'assets/5bib-logo-white.png' : 'assets/5bib-logo.png';
  return (
    <img src={src} alt="5bib" style={{ width, height: 'auto', display: 'block', ...style }} />
  );
}

// ── A "globe" wireframe icon like in the campaign poster ────────────────────
function GlobeIcon({ size = 60, color = '#fff', strokeWidth = 3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <circle cx="30" cy="30" r="26" stroke={color} strokeWidth={strokeWidth} />
      <ellipse cx="30" cy="30" rx="11" ry="26" stroke={color} strokeWidth={strokeWidth} />
      <path d="M4 30h52" stroke={color} strokeWidth={strokeWidth} />
      <path d="M8 16c5 3 13 5 22 5s17-2 22-5M8 44c5-3 13-5 22-5s17 2 22 5" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

// ── LIVE pulse dot ──────────────────────────────────────────────────────────
function LivePulse({ size = 10, t = 0 }) {
  // ping every 1.2s
  const phase = (t % 1.2) / 1.2;
  const ringScale = 1 + phase * 1.6;
  const ringOpacity = (1 - phase) * 0.7;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, verticalAlign: 'middle' }}>
      <span style={{
        position: 'absolute', inset: 0,
        background: '#fff',
        borderRadius: '50%',
        transform: `scale(${ringScale})`,
        opacity: ringOpacity,
      }} />
      <span style={{
        position: 'relative',
        background: '#fff',
        borderRadius: '50%',
        width: size, height: size,
      }} />
    </span>
  );
}

// ── Realistic running BIB (paper race number, pinned to shirt) ──────────────
function RaceBib({ number = '1247', name = 'NGUYEN MINH', event = 'SAIGON HALF 2025', t = 0, style = {} }) {
  // slight wobble like fabric
  const wobble = Math.sin(t * 1.2) * 1.3;
  return (
    <div style={{
      position: 'relative',
      width: 460, padding: '18px 20px 24px',
      background: '#fff',
      borderRadius: 8,
      boxShadow: '0 30px 60px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.06)',
      fontFamily: 'var(--font-display)',
      transform: `rotate(${-2 + wobble * 0.3}deg)`,
      transformOrigin: 'center',
      ...style,
    }}>
      {/* safety pins */}
      <span style={{ position: 'absolute', top: 8, left: 8, width: 14, height: 14, borderRadius: '50%', background: '#9CA3AF', boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.3)' }} />
      <span style={{ position: 'absolute', top: 8, right: 8, width: 14, height: 14, borderRadius: '50%', background: '#9CA3AF', boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.3)' }} />
      <span style={{ position: 'absolute', bottom: 8, left: 8, width: 14, height: 14, borderRadius: '50%', background: '#9CA3AF', boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.3)' }} />
      <span style={{ position: 'absolute', bottom: 8, right: 8, width: 14, height: 14, borderRadius: '50%', background: '#9CA3AF', boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.3)' }} />

      {/* header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px',
        background: 'var(--5s-blue)',
        color: '#fff',
        borderRadius: 4,
        fontSize: 13, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
      }}>
        <span>{event}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>21K</span>
      </div>

      <div style={{
        textAlign: 'center', marginTop: 6,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: 190, lineHeight: 0.95,
        letterSpacing: '-0.03em',
        color: '#0A0A0A',
      }}>
        {number}
      </div>

      <div style={{
        marginTop: -6,
        textAlign: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700, fontSize: 22, letterSpacing: '.04em',
        color: 'var(--5s-text)',
      }}>
        {name}
      </div>

      {/* corner chip + flag like the brand mark */}
      <div style={{
        position: 'absolute', top: 4, right: 4,
        background: 'var(--5s-magenta)',
        color: '#fff',
        padding: '2px 8px',
        fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
        borderRadius: 3,
      }}>5BIB</div>
    </div>
  );
}

// ── Generic "phone" frame (used to show the mobile lookup UI) ───────────────
function PhoneFrame({ width = 420, height = 860, children, style = {} }) {
  return (
    <div style={{
      width, height,
      background: '#0A0A0A',
      borderRadius: 56,
      padding: 14,
      boxShadow: '0 40px 80px -10px rgba(0,0,0,0.45), 0 0 0 1.5px #1f1f1f, inset 0 0 0 1px #2a2a2a',
      position: 'relative',
      ...style,
    }}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--5s-bg)',
        borderRadius: 44,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* notch */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 28,
          background: '#0A0A0A',
          borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
          zIndex: 10,
        }} />
        {children}
      </div>
    </div>
  );
}

// ── Cursor/finger pointer ───────────────────────────────────────────────────
function FingerTap({ x, y, pressed = false }) {
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: 'translate(-30%, -10%)',
      pointerEvents: 'none',
      zIndex: 20,
      transition: 'left 280ms cubic-bezier(0.16,1,0.3,1), top 280ms cubic-bezier(0.16,1,0.3,1)',
      willChange: 'transform',
    }}>
      {/* ripple */}
      <div style={{
        position: 'absolute', left: -8, top: -8,
        width: 64, height: 64,
        borderRadius: '50%',
        background: 'rgba(29,73,255,0.25)',
        opacity: pressed ? 1 : 0,
        transform: `scale(${pressed ? 1.4 : 0.5})`,
        transition: 'all 350ms cubic-bezier(0.16,1,0.3,1)',
      }} />
      <svg width="36" height="44" viewBox="0 0 36 44" fill="none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' }}>
        <path d="M2 2 L2 32 L9 25 L13 38 L18 36 L14 23 L24 23 Z" fill="#fff" stroke="#0A0A0A" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

window.BrandFlood = BrandFlood;
window.NewBubble = NewBubble;
window.BibLogo = BibLogo;
window.GlobeIcon = GlobeIcon;
window.LivePulse = LivePulse;
window.RaceBib = RaceBib;
window.PhoneFrame = PhoneFrame;
window.FingerTap = FingerTap;
