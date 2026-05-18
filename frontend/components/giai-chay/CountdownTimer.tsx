"use client";

import { useEffect, useState } from "react";

/**
 * FEATURE-036 — Client Component, real-time countdown until race startDate.
 *
 * Updates every 60s (good enough — countdown displayed at day level).
 */
export function CountdownTimer({ startDate }: { startDate: string }) {
  const [diff, setDiff] = useState<number>(() => {
    return new Date(startDate).getTime() - Date.now();
  });

  useEffect(() => {
    const t = setInterval(() => {
      setDiff(new Date(startDate).getTime() - Date.now());
    }, 60000);
    return () => clearInterval(t);
  }, [startDate]);

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);

  return (
    <div className="inline-flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900">
      <span>Còn</span>
      {days > 0 && <span className="font-bold">{days} ngày</span>}
      <span className="font-bold">{hours}h</span>
      <span className="font-bold">{mins}m</span>
    </div>
  );
}
