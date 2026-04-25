'use client';

/**
 * Navbar star button — shows watchlist count, opens WatchlistPanel.
 * Triggers background sync of localStorage → backend on first sign-in.
 */

import { useState } from 'react';
import { Star } from 'lucide-react';
import WatchlistPanel from './WatchlistPanel';
import {
  useWatchlistCount,
  useWatchlistSync,
} from '@/lib/hooks/use-athlete-stars';

interface Props {
  /** 'dark' = for light backgrounds. 'light' = for dark/blue header. */
  variant?: 'light' | 'dark';
}

export default function WatchlistButton({ variant = 'light' }: Props) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useWatchlistCount();

  // Hook into auth lifecycle — mounts once in header, syncs localStorage
  // entries when user signs in.
  useWatchlistSync();

  const color =
    variant === 'light'
      ? 'text-white hover:bg-white/10'
      : 'text-slate-700 hover:bg-slate-100';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Danh sách VĐV theo dõi"
        title="VĐV đã theo dõi"
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${color}`}
      >
        <Star
          className="w-5 h-5"
          fill={count > 0 ? '#f59e0b' : 'none'}
          stroke={count > 0 ? '#f59e0b' : 'currentColor'}
        />
        {count > 0 && (
          <span
            aria-label={`${count} VĐV`}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-current"
            style={{ borderColor: variant === 'light' ? '#1d4ed8' : 'white' }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <WatchlistPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
