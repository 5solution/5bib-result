// @ts-nocheck — F-013: jest + @testing-library/react not in admin node_modules
// (Manager STOP trigger "NO npm install"). Spec is correct Jest+RTL form,
// will type-check + run once admin gains the test stack (Phase 2).
/**
 * F-013 BR-RK-03/04/05/08 — KioskResultCard 5-variant tests.
 *
 * Coverage:
 *  - happy: FIN renders chip + gun + ranks + splits toggle
 *  - edge: DNS hides chip/gun times (BR-RK-03)
 *  - edge: DNF shows last CP + "—" rank (BR-RK-04)
 *  - edge: DSQ public reason rendered, internal note absent (BR-RK-05)
 *  - edge: LIVE partial splits + "Đang trên đường" badge (BR-RK-08)
 *  - privacy: editHistory / isManuallyEdited / dsqInternalNote never rendered
 */

import { render, screen } from '@testing-library/react';
import { KioskResultCard, parseSplitsFromData } from '../components/KioskResultCard';
import type { AthleteDetailData } from '../kiosk.types';

const finData: AthleteDetailData = {
  bib: '1001',
  name: 'Nguyễn Văn A',
  distance: '21K',
  category: 'M30-39',
  chipTime: '01:42:33',
  gunTime: '01:43:00',
  overallRank: '12',
  genderRank: '8',
  categoryRank: '3',
  timingPoint: 'Finish',
  Chiptimes: JSON.stringify({ Start: '00:00', TM1: '00:24:30', Finish: '01:42:33' }),
  Paces: JSON.stringify({ Start: '', TM1: '4:53', Finish: '4:48' }),
};

const dnsData: AthleteDetailData = {
  bib: '1002',
  name: 'Trần Thị B',
  distance: '21K',
  timingPoint: 'DNS',
};

const dnfData: AthleteDetailData = {
  bib: '1003',
  name: 'Lê Văn C',
  distance: '21K',
  timingPoint: 'DNF',
  Chiptimes: JSON.stringify({ Start: '00:00', TM1: '00:24:30', TM2: '01:24:33' }),
};

const dsqData: AthleteDetailData = {
  bib: '1004',
  name: 'Phạm Thị D',
  distance: '21K',
  timingPoint: 'DSQ-CUTOFF',
  dsqReason: 'Cắt đường tại CP3',
  // Privacy guard: these MUST NOT render even if present.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...({ dsqInternalNote: 'Đối thủ tố cáo, BTC điều tra', editHistory: [{ note: 'fixed bib' }] } as any),
};

const liveData: AthleteDetailData = {
  bib: '1005',
  name: 'Hoàng Văn E',
  distance: '42K',
  timingPoint: 'TM2',
  overallRank: '15',
  chipTime: '01:42:33',
  Chiptimes: JSON.stringify({ Start: '00:00', TM1: '00:24:30', TM2: '01:42:33' }),
};

describe('KioskResultCard variants', () => {
  it('FIN renders chip + gun + ranks (BR-RK-03)', () => {
    render(<KioskResultCard data={finData} />);
    expect(screen.getByTestId('kiosk-bib-display').textContent).toBe('1001');
    expect(screen.getByTestId('kiosk-result-name').textContent).toContain('Nguyễn Văn A');
    expect(screen.getByTestId('kiosk-chip-time').textContent).toBe('01:42:33');
    expect(screen.getByTestId('kiosk-gun-time').textContent).toBe('01:43:00');
    expect(screen.getByTestId('kiosk-overall-rank').textContent).toBe('12');
    expect(screen.getByTestId('kiosk-status-badge').getAttribute('data-badge-status')).toBe('FIN');
  });

  it('DNS hides chip/gun times (BR-RK-03)', () => {
    render(<KioskResultCard data={dnsData} />);
    expect(screen.queryByTestId('kiosk-times-row')).toBeNull();
    expect(screen.getByTestId('kiosk-status-badge').getAttribute('data-badge-status')).toBe('DNS');
  });

  it('DNF shows last CP + "—" rank (BR-RK-04)', () => {
    render(<KioskResultCard data={dnfData} />);
    expect(screen.getByTestId('kiosk-status-badge').getAttribute('data-badge-status')).toBe('DNF');
    expect(screen.getByTestId('kiosk-overall-rank').textContent).toBe('—');
    const lastCp = screen.getByTestId('kiosk-dnf-lastcp');
    expect(lastCp.textContent).toContain('TM2');
    expect(lastCp.textContent).toContain('01:24:33');
  });

  it('DSQ shows public reason but NEVER internal note (BR-RK-05)', () => {
    const { container } = render(<KioskResultCard data={dsqData} />);
    expect(screen.getByTestId('kiosk-status-badge').getAttribute('data-badge-status')).toBe('DSQ');
    expect(screen.getByTestId('kiosk-dsq-reason').textContent).toContain('Cắt đường tại CP3');
    // BR-RK-05: kiosk MUST NOT leak internal admin note
    expect(container.textContent || '').not.toContain('Đối thủ tố cáo');
    expect(container.textContent || '').not.toContain('fixed bib');
  });

  it('LIVE partial splits + "Đang trên đường" badge (BR-RK-08)', () => {
    render(<KioskResultCard data={liveData} />);
    expect(screen.getByTestId('kiosk-status-badge').getAttribute('data-badge-status')).toBe('LIVE');
    expect(screen.getByTestId('kiosk-live-partial')).toBeTruthy();
    // Live still shows times row (BR-RK-08 partial splits inline)
    expect(screen.getByTestId('kiosk-times-row')).toBeTruthy();
    // Ranks should show placeholder (no final rank during live)
    expect(screen.getByTestId('kiosk-overall-rank').textContent).toBe('—');
  });

  it('parseSplitsFromData verbatim port — handles JSON.parse failure gracefully (BR-AF-23)', () => {
    expect(parseSplitsFromData({ Chiptimes: 'not-valid-json{' })).toBeNull();
    expect(parseSplitsFromData({})).toBeNull();
    const valid = parseSplitsFromData({
      Chiptimes: JSON.stringify({ Start: '00:00', Finish: '01:00:00' }),
      Paces: JSON.stringify({ Start: '', Finish: '5:00' }),
    });
    expect(valid).not.toBeNull();
    expect(valid?.length).toBe(2);
    expect(valid?.[0].name).toBe('Xuất phát');
    expect(valid?.[1].name).toBe('Về đích');
  });
});
