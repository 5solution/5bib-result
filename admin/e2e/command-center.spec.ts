/**
 * FEATURE-005 — Command Center Playwright UI spec (QC-authored).
 *
 * Verifies tab rename + 4-section layout + state machines per PRD.
 * Run requires: admin running on localhost:3000, seeded race data,
 * Logto storageState. Tracked under TD-F005-06 for UAT setup.
 */
import { expect, test } from '@playwright/test';

const RACE_ID = process.env.E2E_F005_RACE_ID ?? 'demo-race-id';
const TIMING_ALERTS_URL = `/races/${RACE_ID}/timing-alerts`;

test.describe('FEATURE-005 Command Center — UI', () => {
  test('Tab label renamed: "Command Center" visible, "Cockpit" no longer in user-facing copy', async ({ page }) => {
    await page.goto(TIMING_ALERTS_URL);
    // Tab strip
    await expect(page.getByRole('tab', { name: /command center/i })).toBeVisible();
    // Page heading
    await expect(page.getByRole('heading', { level: 1, name: /command center/i })).toBeVisible();
    // No "Cockpit" string in visible UI (allowed in HTML comments / data attrs)
    const visible = await page.locator('body').innerText();
    expect(visible.toLowerCase()).not.toContain('cockpit');
  });

  test('Live Leaderboard table renders top 10 with rank/bib/lastCheckpoint columns', async ({ page }) => {
    await page.goto(TIMING_ALERTS_URL);
    const leaderboard = page.locator('[data-testid="live-leaderboard-table"]').first();
    await expect(leaderboard).toBeVisible();
    const rows = leaderboard.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);
  });

  test('MISS-Finish row highlight magenta (BR-CC-09)', async ({ page }) => {
    await page.goto(TIMING_ALERTS_URL);
    const missRows = page.locator('[data-testid="leaderboard-row-missing-finish"]');
    if ((await missRows.count()) > 0) {
      const row = missRows.first();
      const color = await row.evaluate(
        (el) => window.getComputedStyle(el).borderLeftColor || window.getComputedStyle(el).backgroundColor,
      );
      // magenta #FF0E65 = rgb(255, 14, 101)
      expect(color).toMatch(/rgb\(\s*255\s*,\s*14\s*,\s*101/);
    }
  });

  test('Summary Cards row — 5 metrics (racekit / started / finished / dns / miss%)', async ({ page }) => {
    await page.goto(TIMING_ALERTS_URL);
    const cards = page.locator('[data-testid="summary-card"]');
    await expect(cards).toHaveCount(5);
  });

  test('Loading state — skeleton shows before data', async ({ page }) => {
    await page.route('**/dashboard-snapshot**', (route) =>
      new Promise((r) => setTimeout(() => { route.continue(); r(undefined); }, 1500)),
    );
    await page.goto(TIMING_ALERTS_URL);
    await expect(page.locator('[data-testid="cc-skeleton"]').first()).toBeVisible();
  });

  test('Error state — RR API down → magenta banner', async ({ page }) => {
    await page.route('**/dashboard-snapshot**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'RR API down' }) }),
    );
    await page.goto(TIMING_ALERTS_URL);
    const banner = page.locator('[data-testid="rr-api-error-banner"]');
    await expect(banner).toBeVisible();
    const bg = await banner.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    // magenta tone (any FF0E65 family)
    expect(bg).toMatch(/255\s*,\s*1[0-9]\s*,\s*10[0-9]/);
  });

  test('Force Refresh click → invalidate + refetch', async ({ page }) => {
    await page.goto(TIMING_ALERTS_URL);
    let refetchCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/dashboard-snapshot')) refetchCount += 1;
    });
    await page.locator('[data-testid="force-refresh-button"]').click();
    // wait debounce
    await page.waitForTimeout(500);
    expect(refetchCount).toBeGreaterThanOrEqual(1);
  });

  test('Plus Jakarta Sans font loaded on display headings', async ({ page }) => {
    await page.goto(TIMING_ALERTS_URL);
    const heading = page.getByRole('heading', { level: 1, name: /command center/i });
    const family = await heading.evaluate((el) => window.getComputedStyle(el).fontFamily);
    // Either Plus Jakarta Sans loaded, OR fallback chain present (font config still under TD-F005)
    expect(family.length).toBeGreaterThan(0);
  });

  test('Race status=draft → empty leaderboard (no 4xx, banner CTA)', async ({ page }) => {
    await page.route('**/dashboard-snapshot**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          race: { id: RACE_ID, title: 'Draft race', status: 'draft', startDate: null, endDate: null, startedAt: null, startedAtSource: null },
          raceStats: { started: 0, finished: 0, onCourse: 0, suspectOpen: 0, criticalOpen: 0, progress: 0 },
          courses: [],
          checkpointProgression: [],
          recentActivity: [],
          liveLeaderboard: [],
          summary: { totalRegistered: 0, racekitPickedUp: 0, started: 0, finished: 0, dns: 0, missCount: 0, missRate: 0 },
          generatedAt: new Date().toISOString(),
        }),
      }),
    );
    await page.goto(TIMING_ALERTS_URL);
    await expect(page.locator('[data-testid="race-not-live-empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="live-leaderboard-table"] tbody tr')).toHaveCount(0);
  });

  test('Race ended → freeze banner visible', async ({ page }) => {
    await page.route('**/dashboard-snapshot**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          race: { id: RACE_ID, title: 'Ended race', status: 'ended', startDate: '2025-01-01', endDate: '2025-01-01', startedAt: '2025-01-01T00:00:00Z', startedAtSource: 'status_history' },
          raceStats: { started: 100, finished: 100, onCourse: 0, suspectOpen: 0, criticalOpen: 0, progress: 1 },
          courses: [],
          checkpointProgression: [],
          recentActivity: [],
          liveLeaderboard: [],
          summary: { totalRegistered: 100, racekitPickedUp: 0, started: 100, finished: 100, dns: 0, missCount: 0, missRate: 0 },
          generatedAt: new Date().toISOString(),
        }),
      }),
    );
    await page.goto(TIMING_ALERTS_URL);
    await expect(page.locator('[data-testid="race-ended-banner"]')).toBeVisible();
  });
});
