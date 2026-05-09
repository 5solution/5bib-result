'use client';

/**
 * F-008 v2 — Sound ON/OFF toggle for 880Hz CRITICAL alarm.
 *
 * Persists preference via localStorage `cc-sound-enabled` (per-user-per-browser).
 * Default ON for race-day MC safety (BR-CC2 inherit F-005 pattern).
 *
 * Caller wires the actual alarm trigger via `useTimingAlertSse(raceId, {
 * onCriticalAlert: () => { if (isSoundEnabled()) play880Hz(); } })`. Button
 * is purely state UI — it doesn't subscribe to SSE itself.
 */

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isSoundEnabled,
  play880Hz,
  setSoundEnabled,
} from '@/lib/sound-alarm';

export function SoundToggleButton() {
  // Default ON — read localStorage on mount (SSR-safe, no hydration mismatch
  // because we render "ON" first, then sync to localStorage on client).
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    // Test chime when user turns ON — also primes AudioContext past the
    // browser autoplay-policy gesture requirement so the next CRITICAL
    // alert can actually play.
    if (next) {
      play880Hz();
    }
  };

  return (
    <Button
      type="button"
      onClick={toggle}
      variant="outline"
      size="sm"
      className="h-9 gap-2"
      title={
        enabled
          ? 'Bật chuông 880Hz khi có CRITICAL alert mới (click để tắt)'
          : 'Chuông 880Hz đang tắt — click để bật + test chime'
      }
      aria-pressed={enabled}
      data-testid="sound-toggle-button"
    >
      {enabled ? (
        <>
          <Volume2 className="h-3.5 w-3.5" />
          <span>Sound ON</span>
        </>
      ) : (
        <>
          <VolumeX className="h-3.5 w-3.5" />
          <span>Sound OFF</span>
        </>
      )}
    </Button>
  );
}
