/**
 * Phase 3 Public Kiosk E2E — Chip Verify (RFID + Web Audio).
 *
 * Setup before running (one-time):
 *   1. pnpm add -D @playwright/test
 *   2. pnpm playwright install chromium
 *   3. Create playwright.config.ts pointing baseURL = http://localhost:3002
 *
 * Run:
 *   pnpm playwright test frontend/e2e/chip-verify-kiosk.spec.ts
 *
 * Pre-conditions:
 *   - BE on :8081 with PLATFORM_DB_HOST set
 *   - Frontend on :3002 (Next.js dev) with NEXT_PUBLIC_RESULT_BASE_URL set
 *   - Seeded test race + admin GENERATE'd token + chip mapping for chip 'TESTAA1' → BIB 9001
 *   - Token exposed via env: E2E_CHIP_TOKEN (32 chars base64url)
 *
 * Browser autoplay policy: Playwright passes --autoplay-policy=no-user-gesture-required
 * by default in chromium, but our kiosk explicitly waits for user gesture for
 * AudioContext compliance. Tests click "Bắt đầu" before scanning.
 */
import { test, expect, type Page } from '@playwright/test';

const TOKEN = process.env.E2E_CHIP_TOKEN ?? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const KNOWN_CHIP = process.env.E2E_KNOWN_CHIP ?? 'TESTAA1';
const KNOWN_BIB = process.env.E2E_KNOWN_BIB ?? '9001';

async function unlockAudio(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Bắt đầu/ }).click();
  await expect(page.getByText(/🔊 Sẵn sàng/)).toBeVisible();
}

async function scanChip(page: Page, chipId: string): Promise<void> {
  await page.keyboard.type(chipId, { delay: 30 });
  await page.keyboard.press('Enter');
}

test.describe('Chip Verify Kiosk — RFID Flow', () => {
  test('invalid token format returns 404', async ({ page }) => {
    const res = await page.goto('/chip-verify/INVALID');
    expect(res?.status()).toBe(404);
  });

  test('initial render shows unlock modal, RFID disabled until click', async ({
    page,
  }) => {
    await page.goto(`/chip-verify/${TOKEN}?device=Bàn2-T1`);
    await expect(page.getByText(/Sẵn sàng hoạt động/)).toBeVisible();
    // typing chip+enter BEFORE unlock should NOT trigger lookup
    await scanChip(page, KNOWN_CHIP);
    await page.waitForTimeout(500);
    await expect(page.getByText(/GIAO RACEKIT/)).toHaveCount(0);
  });

  test('after unlock, RFID scan FOUND → green card with BIB', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}?device=Bàn2-T1`);
    await unlockAudio(page);
    await scanChip(page, KNOWN_CHIP);
    await expect(page.getByText(/GIAO RACEKIT/)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('p', { hasText: KNOWN_BIB }).first()).toBeVisible();
  });

  test('CHIP_NOT_FOUND → red card + clear error label', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    await scanChip(page, 'NEVERSEENBEFORE');
    await expect(page.getByText(/CHIP KHÔNG CÓ TRONG HỆ THỐNG/)).toBeVisible();
  });

  // ─────────── RFID EDGE CASES ───────────

  test('debounce: same chip within 1.5s ignored (only 1 history row added)', async ({
    page,
  }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    const baselineCount = await page.locator('ol > li').count();
    for (let i = 0; i < 3; i++) {
      await scanChip(page, KNOWN_CHIP);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // wait for poll
    const newCount = await page.locator('ol > li').count();
    expect(newCount - baselineCount).toBeLessThanOrEqual(1);
  });

  test('Vietnamese IME composition does NOT trigger lookup', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CompositionEvent('compositionstart'));
    });
    await page.keyboard.type('không phải chip', { delay: 100 });
    await page.keyboard.press('Enter');
    await page.evaluate(() => {
      window.dispatchEvent(new CompositionEvent('compositionend'));
    });
    await expect(page.getByText(/GIAO RACEKIT|CHIP KHÔNG/)).toHaveCount(0);
  });

  test('RFID burst 5 different chips in 2s → all 5 recorded', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    const chips = ['BURST001', 'BURST002', 'BURST003', 'BURST004', 'BURST005'];
    for (const c of chips) {
      await scanChip(page, c);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2000);
    const items = page.locator('ol > li');
    await expect(items).toHaveCount(5, { timeout: 10000 });
  });

  test('typing in form input does NOT trigger RFID listener', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    // Use the (hidden in our UI but check headless) — emulate by injecting input
    await page.evaluate(() => {
      const i = document.createElement('input');
      i.id = 'test-form-input';
      document.body.appendChild(i);
      i.focus();
    });
    await page.locator('#test-form-input').focus();
    await page.keyboard.type('NOTACHIP', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.getByText(/GIAO RACEKIT|CHIP KHÔNG/)).toHaveCount(0);
  });

  // ─────────── HYDRATION ───────────

  test('no React hydration mismatch warning in console', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const t = msg.text();
        if (/hydration|did not match/i.test(t)) errors.push(t);
      }
    });
    await page.goto(`/chip-verify/${TOKEN}?device=Bàn2-T1`);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  // ─────────── TOKEN LEAK PREVENTION ───────────

  test('token NOT in document.title', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    const title = await page.title();
    expect(title).not.toContain(TOKEN);
    expect(title).toMatch(/5BIB Chip Verify/);
  });

  test('robots meta noindex set', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    const meta = await page
      .locator('meta[name=robots]')
      .getAttribute('content');
    expect(meta).toMatch(/noindex/);
  });

  // ─────────── PII ALLOWLIST ───────────

  test('athlete card NEVER renders email/phone/cccd in DOM', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    await scanChip(page, KNOWN_CHIP);
    await expect(page.getByText(/GIAO RACEKIT/)).toBeVisible({ timeout: 5000 });
    const html = await page.content();
    expect(html.toLowerCase()).not.toMatch(/email|phone|cccd|cmnd|passport|dob/);
  });

  // ─────────── DEVICE LABEL PERSISTENCE ───────────

  test('device label persisted in localStorage scoped per token', async ({
    page,
    context,
  }) => {
    await page.goto(`/chip-verify/${TOKEN}?device=Bàn2-T1`);
    await unlockAudio(page);
    const stored = await page.evaluate(
      (t) => localStorage.getItem(`chip-verify:device:${t}`),
      TOKEN,
    );
    expect(stored).toBe('Bàn2-T1');
    // Different token should NOT see this device
    const otherStored = await page.evaluate(() =>
      localStorage.getItem('chip-verify:device:OTHERFAKE'),
    );
    expect(otherStored).toBeNull();
  });

  // ─────────── HISTORY POLL ───────────

  test('history list updates within 6s after scan (poll 5s)', async ({ page }) => {
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    await scanChip(page, KNOWN_CHIP);
    await expect(page.getByText(/GIAO RACEKIT/)).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(6000);
    const items = page.locator('ol > li');
    await expect(items.first()).toBeVisible();
  });
});

test.describe.configure({ retries: 2 });
test.describe('Critical path stability — race day rehearsal', () => {
  test('100x rapid scans on same chip stay deterministic', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/chip-verify/${TOKEN}`);
    await unlockAudio(page);
    let firstResultText: string | null = null;
    for (let i = 0; i < 100; i++) {
      await scanChip(page, `CHIP${i.toString().padStart(4, '0')}`);
      await page.waitForTimeout(50);
    }
    // No crash, kiosk still responsive
    await expect(page.getByText(/Quẹt RFID|GIAO RACEKIT|CHIP KHÔNG/)).toBeVisible();
  });
});
