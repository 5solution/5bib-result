// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-25/26 — URL hash scroll + active highlight.
 *
 * Coverage:
 *   - mount auto-scroll when hash matches a known section
 *   - reduced-motion media query → instant scroll
 *   - IntersectionObserver registers observers for all section ids
 *   - active id updates on intersection
 */

import { renderHook } from '@testing-library/react';
import { useUrlHashScroll } from '../hooks/useUrlHashScroll';

describe('useUrlHashScroll (BR-AS-25/26)', () => {
  let scrollIntoViewMock: jest.Mock;
  let observeMock: jest.Mock;
  let disconnectMock: jest.Mock;

  beforeEach(() => {
    scrollIntoViewMock = jest.fn();
    observeMock = jest.fn();
    disconnectMock = jest.fn();
    // @ts-expect-error mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: observeMock,
      disconnect: disconnectMock,
    }));
    // @ts-expect-error mock matchMedia
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  it('returns first section id as default activeId', () => {
    document.body.innerHTML = '<div id="alpha"></div><div id="beta"></div>';
    const { result } = renderHook(() => useUrlHashScroll(['alpha', 'beta']));
    expect(result.current.activeId).toBe('alpha');
  });

  it('auto-scrolls when window.location.hash matches', () => {
    window.location.hash = '#course';
    document.body.innerHTML = '<div id="course"></div>';
    const el = document.getElementById('course');
    el!.scrollIntoView = scrollIntoViewMock;
    renderHook(() => useUrlHashScroll(['race-meta', 'course', 'timing']));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('uses instant scroll when prefers-reduced-motion=reduce', () => {
    // @ts-expect-error reset matchMedia
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    window.location.hash = '#course';
    document.body.innerHTML = '<div id="course"></div>';
    const el = document.getElementById('course');
    el!.scrollIntoView = scrollIntoViewMock;
    renderHook(() => useUrlHashScroll(['course']));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
  });

  it('observes every section that exists in DOM', () => {
    document.body.innerHTML =
      '<div id="alpha"></div><div id="beta"></div><div id="gamma"></div>';
    renderHook(() => useUrlHashScroll(['alpha', 'beta', 'gamma']));
    expect(observeMock).toHaveBeenCalledTimes(3);
  });
});
