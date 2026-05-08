/**
 * Shared kiosk lib — barrel export.
 *
 * Minted by F-015. F-013 retrofit is TD-F015-01 (1-line import swap from
 * `result-kiosk/hooks/useKiosk*` to `@/lib/kiosk` post-F-015 ship).
 */

export { useFullscreen } from './useFullscreen';
export { useKioskIdle } from './useKioskIdle';
export { useKioskSound } from './useKioskSound';
export { SHARED_KIOSK_CONFIG } from './kiosk.constant';
export type { SharedKioskConfig } from './kiosk.constant';
export type { KioskMode, IdleState, SoundConfig } from './types';
export type { UseKioskIdleOptions, UseKioskIdleReturn } from './useKioskIdle';
