/**
 * F-008 v2 — AlertDetailDialog wrapper (verbatim re-export).
 *
 * Per BR-CC2-35 + BR-AF-23 settings precedent: wrapper consume migrated
 * `AlertDetailDialog` (F-005 source) via single re-export, ZERO logic
 * change. Lets command-center components import locally without reaching
 * across feature folders.
 */
export { AlertDetailDialog } from '../../timing-alerts/components/AlertDetailDialog';
