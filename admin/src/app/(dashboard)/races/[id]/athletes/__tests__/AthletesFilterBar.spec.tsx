// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-10/11 — AthletesFilterBar interaction.
 *
 * Coverage:
 *   - search input fires onQueryChange
 *   - status chip click toggles selection (multi-select)
 *   - course pill click toggles selection
 *   - reset button calls onReset
 *   - view toggle 4-way (default/live-now/finishers/incidents)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { AthletesFilterBar } from '../components/AthletesFilterBar';

describe('AthletesFilterBar (BR-AS-10/11)', () => {
  const baseProps = {
    filters: {
      q: '',
      statuses: [],
      courseIds: [],
      gender: 'all' as const,
      ageGroup: 'all',
      paid: 'all' as const,
    },
    view: 'default' as const,
    query: '',
    onQueryChange: jest.fn(),
    onSetFilter: jest.fn(),
    onSetView: jest.fn(),
    onReset: jest.fn(),
    courseOptions: [
      { courseId: '10K', name: '10K' },
      { courseId: '21K', name: 'Bán-marathon' },
    ],
    ageGroupOptions: ['M30-39', 'M40-49'],
  };

  beforeEach(() => {
    baseProps.onQueryChange.mockReset();
    baseProps.onSetFilter.mockReset();
    baseProps.onSetView.mockReset();
    baseProps.onReset.mockReset();
  });

  it('search input fires onQueryChange', () => {
    render(<AthletesFilterBar {...baseProps} />);
    const input = screen.getByTestId('athletes-search-input');
    fireEvent.change(input, { target: { value: 'Nguyen' } });
    expect(baseProps.onQueryChange).toHaveBeenCalledWith('Nguyen');
  });

  it('status chip click toggles selection (multi-select add)', () => {
    render(<AthletesFilterBar {...baseProps} />);
    fireEvent.click(screen.getByTestId('status-chip-LIVE'));
    expect(baseProps.onSetFilter).toHaveBeenCalledWith('statuses', ['LIVE']);
  });

  it('status chip click removes when already selected', () => {
    const props = {
      ...baseProps,
      filters: { ...baseProps.filters, statuses: ['DNF'] },
    };
    render(<AthletesFilterBar {...props} />);
    fireEvent.click(screen.getByTestId('status-chip-DNF'));
    expect(baseProps.onSetFilter).toHaveBeenCalledWith('statuses', []);
  });

  it('course pill click adds to selection', () => {
    render(<AthletesFilterBar {...baseProps} />);
    fireEvent.click(screen.getByTestId('course-pill-10K'));
    expect(baseProps.onSetFilter).toHaveBeenCalledWith('courseIds', ['10K']);
  });

  it('view toggle clicks call onSetView', () => {
    render(<AthletesFilterBar {...baseProps} />);
    fireEvent.click(screen.getByTestId('view-toggle-incidents'));
    expect(baseProps.onSetView).toHaveBeenCalledWith('incidents');
  });

  it('reset button calls onReset', () => {
    render(<AthletesFilterBar {...baseProps} />);
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(baseProps.onReset).toHaveBeenCalled();
  });
});
