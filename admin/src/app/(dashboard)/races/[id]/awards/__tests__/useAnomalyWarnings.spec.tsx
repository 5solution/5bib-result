// @ts-nocheck
/**
 * F-019 — useAnomalyWarnings hook spec.
 *
 * STATUS: TD-F013-TESTSTACK: deferred (NO RTL/jest-environment-jsdom in admin).
 *
 * Coverage when activated:
 *  - happy: useAnomalyWarnings(raceId, filter) returns query state with data
 *  - happy: useAckAnomaly mutation invalidates ['awards','anomalies', raceId]
 *  - happy: useResolveAnomaly mutation also invalidates ['awards','podium', raceId]
 *  - edge: 409 conflict response surfaced via mutation.error
 *  - edge: when raceId empty, query disabled (enabled=false)
 *  - happy: tier filter applied as query param to listAnomalies()
 */

// import { renderHook, waitFor } from '@testing-library/react';
// import { useAnomalyWarnings, useAckAnomaly, useResolveAnomaly } from '../hooks/useAnomalyWarnings';
// describe('useAnomalyWarnings — TD-F013-TESTSTACK: deferred', () => {
//   it.skip('fetches anomaly list with filter', () => {});
//   it.skip('invalidates anomalies cache on ack success', () => {});
//   it.skip('invalidates podium cache on resolve success', () => {});
//   it.skip('surfaces 409 conflict via mutation.error', () => {});
//   it.skip('disables query when raceId empty', () => {});
//   it.skip('passes tier filter to listAnomalies', () => {});
// });

export {};
