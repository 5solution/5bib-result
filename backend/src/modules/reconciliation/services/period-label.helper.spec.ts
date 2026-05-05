import {
  renderPeriodLabel,
  filenamePeriodSegment,
} from './period-label.helper';

describe('renderPeriodLabel', () => {
  it('renders single month "Tháng 4 năm 2026"', () => {
    expect(renderPeriodLabel('2026-04-01', '2026-04-30')).toBe(
      'Tháng 4 năm 2026',
    );
  });

  it('renders multi-month within same year', () => {
    expect(renderPeriodLabel('2026-01-01', '2026-03-31')).toBe(
      'Tháng 1 năm 2026 đến Tháng 3 năm 2026',
    );
  });

  it('renders cross-year range', () => {
    expect(renderPeriodLabel('2025-11-01', '2026-02-28')).toBe(
      'Tháng 11 năm 2025 đến Tháng 2 năm 2026',
    );
  });

  it('falls back when input malformed', () => {
    expect(renderPeriodLabel('bad', 'also-bad')).toContain('bad');
  });
});

describe('filenamePeriodSegment', () => {
  it('returns YYYY_MM for single month', () => {
    expect(filenamePeriodSegment('2026-04-01', '2026-04-30')).toBe('2026_04');
  });

  it('returns ranged segment for multi-month', () => {
    expect(filenamePeriodSegment('2026-01-01', '2026-03-31')).toBe(
      '2026_01_den_2026_03',
    );
  });

  it('returns ranged segment for cross-year', () => {
    expect(filenamePeriodSegment('2025-11-01', '2026-02-28')).toBe(
      '2025_11_den_2026_02',
    );
  });

  it('returns "unknown" for malformed input', () => {
    expect(filenamePeriodSegment('', '')).toBe('unknown');
  });
});
