// @ts-nocheck — F-018 deferred RTL spec (TD-F013-TESTSTACK).
/**
 * F-018 StateMachineTimeline — vertical audit log + forward-only enforcement.
 *
 * Coverage when test stack lands:
 *  - empty list → empty-state copy
 *  - 4 transitions render in chronological order
 *  - latest node highlighted (orange dot)
 *  - GPS coords render in mono font when present
 *  - SLA breach badge renders when prop set
 */

import { render, screen } from '@testing-library/react';
import { StateMachineTimeline } from '../components/StateMachineTimeline';

const txns = [
  { from: 'INITIAL', to: 'REPORTED', actorId: 'u1', actorRole: 'operator', at: '2026-05-08T10:00:00Z' },
  { from: 'REPORTED', to: 'MEDIC_DISPATCHED', actorId: 'u2', actorRole: 'medic', at: '2026-05-08T10:02:00Z' },
  { from: 'MEDIC_DISPATCHED', to: 'MEDIC_ON_SITE', actorId: 'u2', actorRole: 'medic', at: '2026-05-08T10:05:00Z',
    gps: { lat: 21.0285, lng: 105.8542, source: 'manual' } },
];

describe('StateMachineTimeline', () => {
  it('renders all transitions chronologically', () => {
    render(<StateMachineTimeline transitions={txns} />);
    expect(screen.getByText(/Đã ghi nhận/)).toBeInTheDocument();
    expect(screen.getByText(/Đã điều y tế/)).toBeInTheDocument();
    expect(screen.getByText(/Y tế đã đến/)).toBeInTheDocument();
  });

  it('shows GPS coords when present', () => {
    render(<StateMachineTimeline transitions={txns} />);
    expect(screen.getByText(/21.02850/)).toBeInTheDocument();
  });

  it('shows SLA breached badge when prop set', () => {
    render(
      <StateMachineTimeline
        transitions={txns}
        currentTimeInState="MEDIC_ON_SITE"
        slaBreached
      />,
    );
    expect(screen.getByText('Vượt SLA')).toBeInTheDocument();
  });
});
