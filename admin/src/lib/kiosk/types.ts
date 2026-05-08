/**
 * Shared kiosk types — minted by F-015 (TD-F015-01 retrofit target for F-013).
 */

/** Generic kiosk surface mode — features extend this with their own state machine. */
export type KioskMode = 'admin' | 'input' | 'result';

export interface IdleState {
  /** Seconds remaining inside the countdown window; null while outside it. */
  idleSecondsRemaining: number | null;
}

export interface SoundConfig {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (next: boolean) => void;
}
