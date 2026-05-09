// @ts-nocheck
/**
 * F-019 — AGPresetPicker spec.
 *
 * STATUS: TD-F013-TESTSTACK: deferred (NO RTL in admin/node_modules).
 *
 * Coverage when activated:
 *  - happy: lists all courses with preset column showing ageGroupPreset value
 *  - happy: "Tính lại AG" button per course triggers useRecompute mutation
 *  - happy: pending state disables button during recompute
 *  - happy: success toast shows podiumsCreatedOrUpdated + warningsCreated counts
 *  - edge: error toast surfaces backend error message
 *  - a11y: button has title=VN.RECOMPUTE_TOOLTIP for screen reader
 */

// import { render, screen, fireEvent } from '@testing-library/react';
// import { AGPresetPicker } from '../components/AGPresetPicker';
// describe('AGPresetPicker — TD-F013-TESTSTACK: deferred', () => {
//   it.skip('lists courses with preset column', () => {});
//   it.skip('triggers recompute mutation on button click', () => {});
//   it.skip('disables button during pending state', () => {});
//   it.skip('shows success toast after recompute completes', () => {});
//   it.skip('shows error toast when backend returns 4xx/5xx', () => {});
//   it.skip('button has tooltip via title attr', () => {});
// });

export {};
