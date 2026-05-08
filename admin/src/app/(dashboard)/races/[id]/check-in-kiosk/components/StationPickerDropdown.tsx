'use client';

/**
 * F-015 Surface 1 — station picker (1..10).
 *
 * Persists selection to localStorage via CheckInModeProvider. Stationless
 * setups should default to "1" — matches existing chip-verification kiosk
 * convention.
 */

import { CHECKIN_CONFIG } from '../checkin.constant';
import { CHECKIN_COPY } from '../checkin.microcopy';

interface StationPickerDropdownProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function StationPickerDropdown({ value, onChange, disabled }: StationPickerDropdownProps) {
  const ids: string[] = [];
  for (let i = CHECKIN_CONFIG.STATION_MIN; i <= CHECKIN_CONFIG.STATION_MAX; i++) {
    ids.push(String(i));
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-stone-700" htmlFor="station-picker">
        {CHECKIN_COPY.tab.stationLabel}
      </label>
      <select
        id="station-picker"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 disabled:opacity-50"
        data-testid="station-picker"
      >
        {ids.map((id) => (
          <option key={id} value={id}>
            Station {id}
          </option>
        ))}
      </select>
      <span className="text-xs text-stone-500">{CHECKIN_COPY.tab.stationHint}</span>
    </div>
  );
}
