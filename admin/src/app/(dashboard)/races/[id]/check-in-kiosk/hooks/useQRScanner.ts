'use client';

/**
 * F-015 — `@zxing/browser` BrowserMultiFormatReader wrapper.
 *
 * Manager Plan §5: dynamic-import the library to keep main bundle slim.
 * `@zxing/browser` + `@zxing/library` together are ~22MB on disk but
 * tree-shakes plus dynamic import keeps initial admin bundle close to
 * F-014 baseline. Library only loads when BTC taps "Quét QR".
 *
 * Permission flow:
 *  1. Hook is dormant until `start()` called from button click handler
 *     (user-gesture-bound — no auto-start).
 *  2. `BrowserMultiFormatReader.decodeFromVideoDevice` triggers browser
 *     camera permission prompt natively.
 *  3. On scan success, `onResult(text)` fires once per session — caller
 *     should `stop()` immediately to release camera.
 *  4. `stop()` cleans up the reader + video stream + cancels decode.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseQRScannerArgs {
  onResult: (text: string) => void;
  onError?: (err: unknown) => void;
}

export interface UseQRScannerReturn {
  scanning: boolean;
  start: (videoEl: HTMLVideoElement) => Promise<void>;
  stop: () => void;
  permissionDenied: boolean;
}

export function useQRScanner({ onResult, onError }: UseQRScannerArgs): UseQRScannerReturn {
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stop = useCallback(() => {
    try {
      if (controlsRef.current && typeof controlsRef.current.stop === 'function') {
        controlsRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    try {
      if (readerRef.current && typeof readerRef.current.reset === 'function') {
        readerRef.current.reset();
      }
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    readerRef.current = null;
    setScanning(false);
  }, []);

  const start = useCallback(async (videoEl: HTMLVideoElement) => {
    try {
      setPermissionDenied(false);
      // Dynamic import — keeps main bundle slim. zxing weight only loads here.
      const mod = await import('@zxing/browser');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Reader = (mod as any).BrowserMultiFormatReader;
      if (!Reader) {
        onErrorRef.current?.(new Error('BrowserMultiFormatReader not available'));
        return;
      }
      const reader = new Reader();
      readerRef.current = reader;
      setScanning(true);

      const controls = await reader.decodeFromVideoDevice(
        undefined, // default device
        videoEl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result: any, err: any) => {
          if (result) {
            const text = typeof result.getText === 'function' ? result.getText() : String(result);
            onResultRef.current(text);
          }
          // err is per-frame "not found" — silent, NOT a real error.
          if (err && err.name && err.name !== 'NotFoundException') {
            onErrorRef.current?.(err);
          }
        },
      );
      controlsRef.current = controls;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as { name?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      setScanning(false);
      onErrorRef.current?.(err);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount.
      try {
        if (controlsRef.current && typeof controlsRef.current.stop === 'function') {
          controlsRef.current.stop();
        }
      } catch { /* ignore */ }
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, []);

  return { scanning, start, stop, permissionDenied };
}
