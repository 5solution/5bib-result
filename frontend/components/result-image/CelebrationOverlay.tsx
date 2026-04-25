'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Celebration overlay — fullscreen confetti + message. Fires automatically the
 * first time an athlete with a PB or Podium badge opens their result page.
 *
 * Gate: localStorage key `celebration-seen:<raceId>:<bib>` prevents replay on
 * refresh/re-navigation. Honors `prefers-reduced-motion` (no animation, just
 * a small toast-style banner).
 *
 * Usage:
 *   <CelebrationOverlay
 *     show={showCelebration}
 *     raceId={race.id}
 *     bib={athlete.Bib}
 *     badges={athlete.badges}
 *     onDismiss={() => setShowCelebration(false)}
 *   />
 */

export interface CelebrationBadge {
  type: string;
  label: string;
  color?: string;
}

export interface CelebrationOverlayProps {
  show: boolean;
  raceId: string;
  bib: string | number;
  badges: CelebrationBadge[];
  onDismiss: () => void;
  /** Auto-dismiss timeout in ms. Default 5000. Set 0 to disable. */
  autoDismissMs?: number;
}

export default function CelebrationOverlay({
  show,
  raceId,
  bib,
  badges,
  onDismiss,
  autoDismissMs = 5000,
}: CelebrationOverlayProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!show || autoDismissMs <= 0) return;
    dismissTimer.current = setTimeout(onDismiss, autoDismissMs);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [show, autoDismissMs, onDismiss]);

  const primary = useMemo(() => pickPrimaryBadge(badges), [badges]);
  const headline = useMemo(() => celebrationHeadline(primary), [primary]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none flex items-start justify-center"
      role="status"
      aria-live="polite"
    >
      {!reducedMotion && (
        <>
          <ConfettiCanvas />
          <style jsx>{`
            @keyframes celebration-enter {
              0% { transform: translateY(-40px) scale(0.9); opacity: 0; }
              60% { transform: translateY(6px) scale(1.04); opacity: 1; }
              100% { transform: translateY(0) scale(1); opacity: 1; }
            }
            .celebration-banner {
              animation: celebration-enter 640ms cubic-bezier(0.22, 1, 0.36, 1);
            }
          `}</style>
        </>
      )}
      <div
        className="celebration-banner pointer-events-auto mt-24 max-w-md w-[90%] rounded-2xl shadow-2xl px-6 py-5 text-white text-center"
        style={{
          background: `linear-gradient(135deg, ${primary?.color ?? '#1d4ed8'} 0%, #312e81 100%)`,
        }}
        onClick={onDismiss}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') onDismiss();
        }}
      >
        <div className="text-xs uppercase tracking-[0.3em] opacity-85 font-bold">
          Chúc mừng!
        </div>
        <div className="text-2xl font-black mt-1">{headline}</div>
        {badges.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {badges.slice(0, 4).map((b) => (
              <span
                key={b.type}
                className="text-xs px-3 py-1 rounded-full bg-white/20 font-semibold backdrop-blur-sm"
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs opacity-75">Chạm để đóng</div>
      </div>
    </div>
  );
}

/**
 * Mark the celebration as seen. Safe to call multiple times (idempotent).
 * Returns whether this was the FIRST time.
 */
export function markCelebrationSeen(raceId: string, bib: string | number): boolean {
  if (typeof window === 'undefined') return false;
  const key = `celebration-seen:${raceId}:${bib}`;
  try {
    if (window.localStorage.getItem(key) === '1') return false;
    window.localStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

/** Check if the celebration has been seen before (without marking). */
export function hasCelebrationBeenSeen(
  raceId: string,
  bib: string | number,
): boolean {
  if (typeof window === 'undefined') return true; // SSR: don't show
  try {
    return window.localStorage.getItem(`celebration-seen:${raceId}:${bib}`) === '1';
  } catch {
    return true;
  }
}

function pickPrimaryBadge(badges: CelebrationBadge[]): CelebrationBadge | null {
  const priority = ['PB', 'PODIUM', 'AG_PODIUM', 'SUB3H', 'SUB90M', 'SUB45M', 'SUB20M', 'ULTRA'];
  for (const p of priority) {
    const hit = badges.find((b) => b.type === p);
    if (hit) return hit;
  }
  return badges[0] ?? null;
}

function celebrationHeadline(badge: CelebrationBadge | null): string {
  if (!badge) return '🎉 Tuyệt vời!';
  switch (badge.type) {
    case 'PB':
      return '🏆 Personal Best!';
    case 'PODIUM':
      return '🥇 Bước lên bục vinh quang!';
    case 'AG_PODIUM':
      return '🏅 Podium lứa tuổi!';
    case 'ULTRA':
      return '🏔️ Ultra Finisher!';
    case 'SUB3H':
      return '⚡ Sub-3 Hour Marathon!';
    case 'SUB90M':
      return '⚡ Sub-90 Half Marathon!';
    case 'SUB45M':
      return '⚡ Sub-45 10K!';
    case 'SUB20M':
      return '⚡ Sub-20 5K!';
    default:
      return `🎉 ${badge.label}`;
  }
}

// ─── Confetti ─────────────────────────────────────────────────

/**
 * Lightweight confetti: canvas-based, ~120 particles, 3s total duration, then
 * auto-removes. Runs off requestAnimationFrame — stops cleanly on unmount.
 */
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const colors = ['#1d4ed8', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * W(),
      y: -20 - Math.random() * 100,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 14,
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: -0.15 + Math.random() * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }));

    let raf: number;
    const start = performance.now();
    const duration = 2800;
    const loop = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, W(), H());
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.rot += p.vr;
        p.life = 1 - elapsed / (duration + 500);
        if (p.life < 0) p.life = 0;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < duration) {
        raf = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, W(), H());
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
