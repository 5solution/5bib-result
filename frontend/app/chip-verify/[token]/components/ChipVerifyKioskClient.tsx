'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  lookupChip,
  type ChipLookupResponse,
  type ChipResult,
} from '@/lib/chip-verify-api';
import { ChipInputCapture } from './ChipInputCapture';
import { AthleteCard } from './AthleteCard';
import { HistoryList } from './HistoryList';
import { StatsCounter } from './StatsCounter';
import { useSoundFeedback, type SoundType } from './useSoundFeedback';

interface Props {
  token: string;
  defaultDevice: string;
}

const RESULT_TO_SOUND: Record<ChipResult, SoundType> = {
  FOUND: 'found',
  ALREADY_PICKED_UP: 'alreadyPickedUp',
  CHIP_NOT_FOUND: 'notFound',
  BIB_UNASSIGNED: 'bibUnassigned',
  DISABLED: 'notFound',
};

/**
 * BUG #FE-4 fix — scope localStorage by token so 1 browser used across 2
 * races doesn't leak/overwrite device labels between them.
 */
const deviceStorageKey = (token: string) => `chip-verify:device:${token}`;

export function ChipVerifyKioskClient({ token, defaultDevice }: Props) {
  const queryClient = useQueryClient();
  const { play, unlock } = useSoundFeedback();
  const [audioReady, setAudioReady] = useState(false);
  // BUG #FE-1 fix — initialize state with prop only (deterministic on both
  // server SSR pass and client first render). Populate from localStorage in
  // useEffect AFTER mount to avoid React 19 hydration mismatch.
  const [device, setDevice] = useState<string>(defaultDevice);
  const [lastResult, setLastResult] = useState<ChipLookupResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Populate device from localStorage post-mount (no hydration mismatch).
  useEffect(() => {
    if (defaultDevice) return; // explicit query-string device wins
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(deviceStorageKey(token));
    if (stored) setDevice(stored);
  }, [defaultDevice, token]);

  // Persist device label across reloads (per-token scope).
  useEffect(() => {
    if (!device || typeof window === 'undefined') return;
    localStorage.setItem(deviceStorageKey(token), device);
  }, [device, token]);

  const lookup = useMutation({
    mutationFn: (chipId: string) => lookupChip(token, chipId, device || undefined),
    onSuccess: (data) => {
      setLastResult(data);
      setLookupError(null);
      play(RESULT_TO_SOUND[data.result]);
      // Refresh history + stats after each successful lookup
      queryClient.invalidateQueries({ queryKey: ['chip-recent', token] });
      queryClient.invalidateQueries({ queryKey: ['chip-stats-public', token] });
    },
    onError: (err) => {
      setLookupError((err as Error).message);
      play('notFound');
    },
  });

  const handleScan = useCallback(
    (chipId: string) => {
      if (!audioReady) {
        // Block scan until user unlocks audio (browser policy)
        return;
      }
      lookup.mutate(chipId);
    },
    [audioReady, lookup],
  );

  const handleUnlock = useCallback(() => {
    unlock();
    setAudioReady(true);
  }, [unlock]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">5BIB Chip Verify</h1>
          <p className="text-sm text-stone-600">
            Quẹt RFID để xác nhận nhận racekit
            {device && (
              <span className="ml-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {device}
              </span>
            )}
          </p>
        </div>
        {audioReady && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            🔊 Sẵn sàng
          </span>
        )}
      </header>

      {/* RFID listener — disabled until audio unlocked + on error display */}
      <ChipInputCapture onScan={handleScan} disabled={!audioReady} />

      {/* Unlock modal — must click before any RFID scan works (browser policy) */}
      {!audioReady && (
        <section className="rounded-xl border-2 border-blue-300 bg-blue-50 p-6 text-center sm:p-8">
          <h2 className="text-xl font-bold text-blue-900">Sẵn sàng hoạt động?</h2>
          <p className="mt-2 text-sm text-blue-800">
            Nhấn nút bên dưới để kích hoạt âm thanh + bắt đầu nhận RFID.
          </p>
          <button
            type="button"
            onClick={handleUnlock}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            Bắt đầu
          </button>
        </section>
      )}

      {/* Stats */}
      {audioReady && <StatsCounter token={token} />}

      {/* Last scan result */}
      {audioReady && lookup.isPending && (
        <section className="rounded-xl border-2 border-stone-300 bg-white p-6 text-center">
          <p className="text-sm text-stone-600">Đang tra cứu...</p>
        </section>
      )}

      {audioReady && !lookup.isPending && lastResult && (
        <AthleteCard data={lastResult} />
      )}

      {/* Manual input + initial empty state. RFID reader (USB HID) gửi
          keystroke vào page nên KHÔNG cần focus input — global ChipInputCapture
          listener tự catch. Nhưng có visible input cho test thủ công + UX
          rõ ràng. Input KHÔNG có data-rfid-capture nên global listener bỏ
          qua (tránh double-fire), input tự handle Enter. */}
      {audioReady && !lookup.isPending && !lastResult && !lookupError && (
        <ManualScanInput onSubmit={handleScan} />
      )}
      {audioReady && (lookup.isPending || lastResult || lookupError) && (
        <ManualScanInput onSubmit={handleScan} compact />
      )}

      {lookupError && (
        <section className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-red-900">⚠️ {lookupError}</p>
            <button
              onClick={() => setLookupError(null)}
              className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-200"
            >
              Đóng
            </button>
          </div>
        </section>
      )}

      {/* History */}
      {audioReady && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Lịch sử 20 lần quẹt gần nhất</h2>
          <HistoryList token={token} />
        </section>
      )}

      <footer className="pt-6 text-center text-xs text-stone-400">
        5BIB Chip Verify v1.2 · Pilot 2026-05
      </footer>
    </div>
  );
}

/**
 * Manual chip ID input — for human testing without USB RFID reader.
 * RFID hardware sends keystrokes globally (no focus needed), caught by
 * `ChipInputCapture`. This input is for manual typing only.
 *
 * Auto-focus on mount + after each successful submit. KHÔNG có
 * `data-rfid-capture` attribute → global listener ignore keystrokes here
 * (avoid double-fire), input tự xử lý Enter.
 */
function ManualScanInput({
  onSubmit,
  compact,
}: {
  onSubmit: (chipId: string) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setValue('');
    // Re-focus for next scan
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (compact) {
    return (
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Gõ chip ID + Enter (hoặc quẹt RFID)"
          className="flex-1 rounded-lg border-2 border-stone-300 bg-white px-4 py-3 font-mono text-base focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Quẹt
        </button>
      </form>
    );
  }

  return (
    <section className="rounded-xl border-2 border-dashed border-stone-300 bg-white p-6 text-center sm:p-8">
      <p className="text-lg font-semibold text-stone-700">
        Quẹt RFID hoặc gõ chip ID
      </p>
      <p className="mt-1 mb-4 text-sm text-stone-500">
        RFID reader cắm USB sẽ tự gửi → không cần click vào ô bên dưới
      </p>
      <form onSubmit={submit} className="mx-auto flex max-w-md gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="VD: Y-359"
          className="flex-1 rounded-lg border-2 border-stone-300 bg-white px-4 py-3 text-center font-mono text-base focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={!value.trim()}
        >
          Quẹt
        </button>
      </form>
    </section>
  );
}
