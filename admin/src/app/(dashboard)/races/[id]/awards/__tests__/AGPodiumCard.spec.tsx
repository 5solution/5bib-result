// @ts-nocheck
/**
 * F-019 — AGPodiumCard component spec.
 *
 * STATUS: TD-F013-TESTSTACK: deferred (NO @testing-library/react in admin/node_modules).
 * Activate: install RTL + jsdom + @types/jest, flip testRegex in jest.kiosk.config.cjs.
 *
 * Pattern reference: F-013 KioskResultCard.spec.tsx + F-018 IncidentList.spec.tsx.
 *
 * Coverage when activated:
 *  - happy: renders 3 athletes top-3 with medal icons (1st/2nd/3rd) and rank cells
 *  - happy: shows compounding mode badge when mutually_exclusive
 *  - happy: lock button DISABLED when blockingMessage prop set (BR-AG-24)
 *  - happy: state transition button calls usePodiumStateMachine mutation
 *  - edge: empty athletes array shows "Chưa có athlete trong AG này"
 *  - edge: ex-aequo athletes display tied marker (asterisk)
 *  - a11y: state badge announced via aria-label
 */

// import { render, screen, fireEvent } from '@testing-library/react';
// import { AGPodiumCard } from '../components/AGPodiumCard';
// describe('AGPodiumCard — TD-F013-TESTSTACK: deferred', () => {
//   it.skip('renders top-3 athletes with medal icons', () => {});
//   it.skip('shows mutually_exclusive badge when applicable', () => {});
//   it.skip('disables lock button when blockingMessage set (BR-AG-24)', () => {});
//   it.skip('triggers state machine mutation on lock click', () => {});
//   it.skip('shows empty state when athletes empty', () => {});
//   it.skip('marks tied athletes with asterisk', () => {});
//   it.skip('announces state via aria-label', () => {});
// });

// Placeholder export so jest doesn't error on empty file when it does match.
export {};
