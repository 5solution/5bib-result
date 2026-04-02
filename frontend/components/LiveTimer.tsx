'use client';

import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

interface LiveTimerProps {
  startDate: string;
  className?: string;
  variant?: 'badge' | 'hero';
}

export default function LiveTimer({ startDate, className = '', variant = 'badge' }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const start = new Date(startDate).getTime();
    if (isNaN(start)) return;

    const update = () => {
      const now = Date.now();
      const diff = now - start;
      if (diff < 0) {
        // Race hasn't started yet — show countdown
        const absDiff = Math.abs(diff);
        const days = Math.floor(absDiff / 86400000);
        const hours = Math.floor((absDiff % 86400000) / 3600000);
        const mins = Math.floor((absDiff % 3600000) / 60000);
        const secs = Math.floor((absDiff % 60000) / 1000);
        if (days > 0) {
          setElapsed(`-${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        } else {
          setElapsed(`-${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      } else {
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        if (days > 0) {
          setElapsed(`${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        } else {
          setElapsed(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  if (!elapsed) return null;

  if (variant === 'hero') {
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 ${className}`}>
        <Timer className="w-4 h-4 text-red-400" />
        <span className="text-sm font-medium text-white/80">Thời gian</span>
        <span className="font-mono text-lg font-black text-white tabular-nums tracking-wider">
          {elapsed}
        </span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded text-xs font-bold text-white ${className}`}>
      <Timer className="w-3.5 h-3.5 text-red-400" />
      <span className="font-mono tabular-nums">{elapsed}</span>
    </span>
  );
}
