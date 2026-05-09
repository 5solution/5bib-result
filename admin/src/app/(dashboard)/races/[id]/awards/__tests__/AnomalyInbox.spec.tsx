// @ts-nocheck
/**
 * F-019 — AnomalyInbox drawer spec.
 *
 * STATUS: TD-F013-TESTSTACK: deferred (NO RTL in admin/node_modules).
 * Pattern reference: F-018 IncidentDetailDrawer.spec.tsx.
 *
 * Coverage when activated:
 *  - happy: lists warnings grouped by tier
 *  - happy: tier filter buttons toggle list (Mức 1/2/3 / Tất cả)
 *  - happy: ack mutation called when user submits ack form (note ≥5 chars)
 *  - happy: resolve mutation with resolution + note + optional evidenceUrl
 *  - edge: empty state "Không có cảnh báo bất thường — sẵn sàng lock podium ✓"
 *  - edge: ack button disabled when note < 5 chars
 *  - a11y: tier filter buttons aria-pressed reflect active state
 */

// import { render, screen, fireEvent } from '@testing-library/react';
// import { AnomalyInbox } from '../components/AnomalyInbox';
// describe('AnomalyInbox — TD-F013-TESTSTACK: deferred', () => {
//   it.skip('groups warnings by tier', () => {});
//   it.skip('toggles tier filter via button click', () => {});
//   it.skip('triggers ack mutation when form submitted', () => {});
//   it.skip('triggers resolve mutation with selected resolution', () => {});
//   it.skip('shows empty state success message', () => {});
//   it.skip('disables ack button when note too short', () => {});
//   it.skip('aria-pressed reflects tier filter state', () => {});
// });

export {};
