/**
 * F-041 GA4 Analytics + Cookie Consent E2E (Playwright).
 *
 * Setup before running (one-time, matches chip-verify-kiosk.spec.ts pattern):
 *   1. pnpm add -D @playwright/test
 *   2. pnpm playwright install chromium
 *   3. Create playwright.config.ts pointing baseURL = http://localhost:3002
 *
 * Run:
 *   pnpm playwright test frontend/e2e/ga4-consent-flow.spec.ts
 *
 * Pre-conditions:
 *   - Frontend on :3002 with NEXT_PUBLIC_GA_ID=G-PNVB69YRL2 in .env.production (PROD build)
 *   - Or .env.local override for local dev
 *   - Test race fixture: `cat-tien-jungle-paths-2026` with course `trail-70km` + BIB 7055
 *
 * Coverage: 15 E2E test cases per PRD `01-ba-prd.md` Testing Mandates.
 * Authored by: 5bib-qc-gatekeeper (FEATURE-041 QC phase).
 */
import { test, expect, type Page } from '@playwright/test';

const CONSENT_KEY = '5bib_consent_v1';

// Helper: snapshot window.dataLayer for assertion.
async function getDataLayer(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    return w.dataLayer ?? [];
  });
}

// Helper: find event in dataLayer by event name.
async function findEvent(page: Page, eventName: string): Promise<Record<string, unknown> | null> {
  const dl = await getDataLayer(page);
  for (const entry of dl) {
    // dataLayer entries can be arrays (gtag call args) or objects
    if (Array.isArray(entry) && entry[0] === 'event' && entry[1] === eventName) {
      return (entry[2] as Record<string, unknown>) ?? null;
    }
    if (typeof entry === 'object' && entry !== null && (entry as { event?: string }).event === eventName) {
      return entry as Record<string, unknown>;
    }
  }
  return null;
}

// Helper: pre-seed consent in localStorage to skip banner.
async function seedConsent(page: Page, accepted: boolean, daysOld = 0): Promise<void> {
  await page.addInitScript(
    ([key, accepted, daysOld]) => {
      const ts = new Date(Date.now() - (daysOld as number) * 86400000).toISOString();
      window.localStorage.setItem(
        key as string,
        JSON.stringify({ accepted: accepted as boolean, timestamp: ts, version: 1 }),
      );
    },
    [CONSENT_KEY, accepted, daysOld] as const,
  );
}

test.describe('F-041 — Cookie Consent Banner Flow', () => {
  // E2E-01 Accept consent
  test('E2E-01: banner appears + accept persists localStorage + tracking enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000); // SHOW_DELAY_MS 1500 + buffer
    const banner = page.locator('[role="dialog"][aria-label*="cookie"i]');
    await expect(banner).toBeVisible();
    await page.click('[data-testid="cookie-consent-accept"]');
    await page.waitForTimeout(400); // fade-out 200 + buffer
    await expect(banner).not.toBeVisible();
    const ls = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      CONSENT_KEY,
    );
    expect(ls?.accepted).toBe(true);
    expect(ls?.version).toBe(1);
    const consentAccept = await findEvent(page, 'consent_accept');
    expect(consentAccept).not.toBeNull();
  });

  // E2E-02 Reject consent → no tracking
  test('E2E-02: reject button denies tracking, no events fire on navigate', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.click('[data-testid="cookie-consent-reject"]');
    await page.waitForTimeout(400);
    const ls = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      CONSENT_KEY,
    );
    expect(ls?.accepted).toBe(false);
    await page.goto('/calendar');
    await page.waitForTimeout(1000);
    const viewCalendar = await findEvent(page, 'view_race_calendar');
    expect(viewCalendar).toBeNull(); // BR-41-03 — consent denied = no events
  });

  // E2E-03 Returning visitor (accepted) — banner KHÔNG re-show
  test('E2E-03: pre-seeded accepted consent → banner hidden + tracking active', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/');
    await page.waitForTimeout(2000);
    const banner = page.locator('[role="dialog"][aria-label*="cookie"i]');
    await expect(banner).not.toBeVisible();
    // page_view should fire via Enhanced Measurement
    const dl = await getDataLayer(page);
    expect(dl.length).toBeGreaterThan(0);
  });

  // E2E-04 Returning visitor (rejected) — banner hidden + no tracking
  test('E2E-04: pre-seeded rejected consent → no banner, no events', async ({ page }) => {
    await seedConsent(page, false);
    await page.goto('/');
    await page.waitForTimeout(2000);
    const banner = page.locator('[role="dialog"][aria-label*="cookie"i]');
    await expect(banner).not.toBeVisible();
    await page.goto('/calendar');
    await page.waitForTimeout(1000);
    const viewCalendar = await findEvent(page, 'view_race_calendar');
    expect(viewCalendar).toBeNull();
  });

  // E2E-05 view_race event with race_slug param
  test('E2E-05: view_race fires with race_slug param', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/races/cat-tien-jungle-paths-2026');
    await page.waitForTimeout(2000);
    const evt = await findEvent(page, 'view_race');
    expect(evt).not.toBeNull();
    expect(evt?.race_slug).toBe('cat-tien-jungle-paths-2026');
  });

  // E2E-06 view_athlete with bib param
  test('E2E-06: view_athlete fires with race_slug + bib + from_route', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/races/cat-tien-jungle-paths-2026/7055');
    await page.waitForTimeout(2000);
    const evt = await findEvent(page, 'view_athlete');
    expect(evt).not.toBeNull();
    expect(evt?.race_slug).toBe('cat-tien-jungle-paths-2026');
    expect(evt?.bib).toBe('7055');
    expect(evt?.from_route).toBe('direct');
  });

  // E2E-07 share_athlete fires on Facebook share click
  test('E2E-07: share_athlete fires with share_method=link', async ({ page, context }) => {
    await seedConsent(page, true);
    await page.goto('/races/cat-tien-jungle-paths-2026/7055');
    await page.waitForTimeout(2000);
    // Block popup window to avoid actual Facebook navigation
    context.on('page', (p) => p.close().catch(() => {}));
    // Find share button — Facebook icon button in FloatingActionBar or main share area
    const shareBtn = page.locator('button:has-text("Chia sẻ")').first();
    if (await shareBtn.isVisible()) await shareBtn.click();
    await page.waitForTimeout(500);
    const evt = await findEvent(page, 'share_athlete');
    expect(evt).not.toBeNull();
    expect(evt?.share_method).toBe('link');
  });

  // E2E-08 Search submit debounce verification
  test('E2E-08: search event fires post-submit with result_count', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/search');
    await page.waitForTimeout(1000);
    const input = page.locator('input[type="text"]').first();
    await input.fill('Nguyen');
    await input.press('Enter');
    await page.waitForTimeout(2000); // fetch + effect
    const evt = await findEvent(page, 'search');
    expect(evt).not.toBeNull();
    expect(evt?.search_term).toBe('Nguyen');
    expect(typeof evt?.result_count).toBe('number');
  });

  // E2E-09 PII filter — athlete name MUST NOT appear in dataLayer
  test('E2E-09: PII verify — no athlete name in dataLayer (BR-41-05)', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/races/cat-tien-jungle-paths-2026/7055');
    await page.waitForTimeout(3000);
    const dl = await getDataLayer(page);
    const json = JSON.stringify(dl);
    // Should NOT contain common PII fragments
    expect(json).not.toContain('NGUYỄN');
    expect(json).not.toContain('athlete_name');
    expect(json).not.toContain('"email"');
    expect(json).not.toContain('"phone"');
    expect(json).not.toContain('"fullname"');
    expect(json).not.toContain('"address"');
  });

  // E2E-10 Cookie persistence 364d (within TTL)
  test('E2E-10: pre-seeded consent 364 days old → still hidden', async ({ page }) => {
    await seedConsent(page, true, 364);
    await page.goto('/');
    await page.waitForTimeout(2000);
    const banner = page.locator('[role="dialog"][aria-label*="cookie"i]');
    await expect(banner).not.toBeVisible();
  });

  // E2E-11 Cookie expiry 366d (past TTL)
  test('E2E-11: pre-seeded consent 366 days old → banner re-shows', async ({ page }) => {
    await seedConsent(page, true, 366);
    await page.goto('/');
    await page.waitForTimeout(2000);
    const banner = page.locator('[role="dialog"][aria-label*="cookie"i]');
    await expect(banner).toBeVisible();
  });

  // E2E-12 Lang dimension follows i18n state
  test('E2E-12: lang dimension reflects i18n state', async ({ page }) => {
    await seedConsent(page, true);
    await page.addInitScript(() => {
      window.localStorage.setItem('i18nextLng', 'en');
    });
    await page.goto('/races/cat-tien-jungle-paths-2026');
    await page.waitForTimeout(2000);
    const evt = await findEvent(page, 'view_race');
    expect(evt?.lang).toBe('en');
  });

  // E2E-13 Sponsor click fires select_sponsor
  test('E2E-13: sponsor sidebar click fires select_sponsor with non-PII params', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/races/cat-tien-jungle-paths-2026');
    await page.waitForTimeout(2000);
    const sponsorLink = page.locator('aside a[target="_blank"]').first();
    if (await sponsorLink.count() > 0) {
      await sponsorLink.click({ modifiers: ['Meta'] }); // open in new tab w/o leaving page
      await page.waitForTimeout(500);
      const evt = await findEvent(page, 'select_sponsor');
      expect(evt).not.toBeNull();
      expect(evt?.position).toBe('sidebar');
      expect(typeof evt?.sponsor_id).toBe('string');
    }
  });

  // E2E-14 Course tab click fires select_course_tab
  test('E2E-14: course card click fires select_course_tab with tab_index', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/races/cat-tien-jungle-paths-2026');
    await page.waitForTimeout(2000);
    const courseLink = page.locator('a[href*="/ranking/"]').first();
    if (await courseLink.count() > 0) {
      await courseLink.click();
      await page.waitForTimeout(500);
      const evt = await findEvent(page, 'select_course_tab');
      expect(evt).not.toBeNull();
      expect(evt?.race_slug).toBe('cat-tien-jungle-paths-2026');
      expect(typeof evt?.tab_index).toBe('number');
    }
  });

  // E2E-15 Calendar filter status tab fires filter_calendar
  test('E2E-15: calendar status filter click fires filter_calendar event', async ({ page }) => {
    await seedConsent(page, true);
    await page.goto('/calendar');
    await page.waitForTimeout(2000);
    const upcomingTab = page.locator('button:has-text("upcoming"i), button:has-text("sắp diễn ra"i)').first();
    if (await upcomingTab.count() > 0) {
      await upcomingTab.click();
      await page.waitForTimeout(500);
      const evt = await findEvent(page, 'filter_calendar');
      expect(evt).not.toBeNull();
      expect(evt?.filter_type).toBe('status');
    }
  });
});

test.describe('F-041 — 10x Stability', () => {
  test('CONSENT-10X: 10 rapid Accept clicks produce exactly 1 persisted record', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const acceptBtn = page.locator('[data-testid="cookie-consent-accept"]');
    // Rapid-fire: click 10x as fast as possible (submitting guard should debounce)
    for (let i = 0; i < 10; i++) {
      if (await acceptBtn.isVisible()) await acceptBtn.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(500);
    const ls = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      CONSENT_KEY,
    );
    expect(ls?.accepted).toBe(true);
    // Verify exactly 1 consent_accept event (NOT 10) — submitting guard works
    const dl = await getDataLayer(page);
    const consentEvents = dl.filter((e) =>
      Array.isArray(e) && e[0] === 'event' && e[1] === 'consent_accept',
    );
    expect(consentEvents.length).toBe(1);
  });

  test('VIEW-EVENT-10X: 10 rapid navigations between race + athlete fire correct events', async ({ page }) => {
    await seedConsent(page, true);
    for (let i = 0; i < 10; i++) {
      await page.goto(`/races/cat-tien-jungle-paths-2026/7055`);
      await page.waitForTimeout(100);
      await page.goto(`/races/cat-tien-jungle-paths-2026`);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000);
    const dl = await getDataLayer(page);
    const athleteEvents = dl.filter((e) =>
      Array.isArray(e) && e[0] === 'event' && e[1] === 'view_athlete',
    );
    const raceEvents = dl.filter((e) =>
      Array.isArray(e) && e[0] === 'event' && e[1] === 'view_race',
    );
    expect(athleteEvents.length).toBeGreaterThanOrEqual(8); // allow some debounce
    expect(raceEvents.length).toBeGreaterThanOrEqual(8);
  });
});
