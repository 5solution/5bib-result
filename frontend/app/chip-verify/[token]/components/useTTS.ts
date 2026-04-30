'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'chip-verify-tts';

/**
 * Web Speech API TTS hook cho kiosk Bàn 2.
 *
 * BR-01: chỉ đọc khi result=FOUND (caller responsibility — gọi speakAthlete
 * trong onSuccess FOUND).
 * BR-04: cancel utterance cũ trước khi speak mới — không chồng giọng.
 * BR-05: default ON sau khi audio unlocked.
 * BR-06: toggle persist trong sessionStorage (per session, không cross-session).
 * BR-08: degrade gracefully nếu browser không hỗ trợ speechSynthesis.
 *
 * IMPORTANT: Browser tự pick voice mặc định = en-US dù `utterance.lang='vi-VN'`.
 * Phải EXPLICIT set `utterance.voice = vnVoice` mới đọc đúng tiếng Việt
 * stable qua mọi lần speak. `voiceschanged` event fire async khi browser
 * load voices list (lần đầu page load có thể empty array).
 */
export function useTTS() {
  const [supported, setSupported] = useState(false);
  // Init enabled = true (default ON). Read sessionStorage in useEffect post-mount
  // để tránh hydration mismatch (server không có sessionStorage).
  const [enabled, setEnabled] = useState(true);
  // Pinned vi-VN voice — refresh khi voiceschanged event fire.
  const vnVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported('speechSynthesis' in window);
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved !== null) setEnabled(saved === 'true');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  // Pick + pin vi-VN voice. Listen voiceschanged để re-pick khi browser
  // load voices list async (Chrome lần đầu thường empty).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const pickVoice = () => {
      const voices = synth.getVoices();
      // Ưu tiên: 'vi-VN' exact > 'vi' prefix > Vietnamese name fallback
      const exact = voices.find((v) => v.lang === 'vi-VN');
      const prefix = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
      const byName = voices.find((v) => /vietnam/i.test(v.name));
      vnVoiceRef.current = exact ?? prefix ?? byName ?? null;
    };
    pickVoice();
    synth.addEventListener('voiceschanged', pickVoice);
    return () => synth.removeEventListener('voiceschanged', pickVoice);
  }, []);

  // Cleanup on unmount — cancel any pending utterance, free synthesis queue.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakAthlete = useCallback(
    (bib: string | null, name: string | null): void => {
      if (typeof window === 'undefined') return;
      if (!enabled || !supported) return;
      if (!bib) return;

      const synth = window.speechSynthesis;
      // BR-04: cancel utterance đang chạy / queued
      synth.cancel();

      // Số BIB đọc tách từng chữ số (5-8-2-8-8) thay vì đọc nguyên số
      // ("năm mươi tám nghìn..."), dễ nghe + tránh ambiguity số dài.
      // Chèn space giữa mỗi digit. Non-digit chars (VD bib có dấu '-')
      // giữ nguyên để TTS pause tự nhiên.
      const spokenBib = bib
        .split('')
        .map((ch) => (/[0-9]/.test(ch) ? ch : ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const text =
        name && name.trim()
          ? `${spokenBib}, ${name.trim()}`
          : spokenBib;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.1;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;
      // EXPLICIT pin vi-VN voice — nếu không browser fallback sang en-US sau
      // lần đầu speak (bug Chrome với utterance reuse).
      if (vnVoiceRef.current) {
        utterance.voice = vnVoiceRef.current;
      } else {
        // Re-fetch voices nếu voiceschanged chưa fire (race condition first load)
        const voices = synth.getVoices();
        const fallback =
          voices.find((v) => v.lang === 'vi-VN') ??
          voices.find((v) => v.lang.toLowerCase().startsWith('vi')) ??
          null;
        if (fallback) {
          utterance.voice = fallback;
          vnVoiceRef.current = fallback;
        }
      }
      synth.speak(utterance);
    },
    [enabled, supported],
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      // Cancel utterance đang chạy nếu tắt
      if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  return { speakAthlete, toggle, enabled, supported };
}
