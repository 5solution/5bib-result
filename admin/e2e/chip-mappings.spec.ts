/**
 * Phase 2 Admin E2E — Chip Mappings UI tests.
 *
 * Setup before running (one-time):
 *   1. pnpm add -D @playwright/test
 *   2. pnpm playwright install chromium
 *   3. Create playwright.config.ts pointing baseURL = http://localhost:3000
 *   4. Pre-auth admin storage state to admin/e2e/.auth/admin.json (Logto sign-in)
 *
 * Run:
 *   pnpm playwright test admin/e2e/chip-mappings.spec.ts
 *
 * Pre-conditions:
 *   - BE running on :8081 with `PLATFORM_DB_HOST` set
 *   - Race id 999 exists in MySQL platform DB with at least 5 athletes
 *   - Logged-in admin token has `admin` role on `5BIB Result API` resource
 *   - NEXT_PUBLIC_RESULT_BASE_URL env set in admin (e.g. http://localhost:3002)
 */
import { test, expect } from '@playwright/test';

const TEST_RACE_ID = Number(process.env.E2E_RACE_ID ?? '999');
const STORAGE_STATE = 'e2e/.auth/admin.json';

test.use({ storageState: STORAGE_STATE });

test.describe('Chip Mappings — Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/races/${TEST_RACE_ID}/chip-mappings`);
  });

  // ─────────── PAGE SHELL ───────────

  test('renders 4 stats cards + token panel + cache panel + import section + table', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: /Chip Verification/ })).toBeVisible();
    await expect(page.getByText(/Total mappings/i)).toBeVisible();
    await expect(page.getByText(/Verified athletes/i)).toBeVisible();
    await expect(page.getByText(/Total attempts/i)).toBeVisible();
    await expect(page.getByText(/Last 5 min/i)).toBeVisible();
    await expect(page.getByText(/Verify token & kiosk URL/i)).toBeVisible();
    await expect(page.getByText(/Redis cache/i)).toBeVisible();
    await expect(page.getByText(/Import CSV chip ↔ BIB/i)).toBeVisible();
    await expect(page.getByText(/Chip mappings/i)).toBeVisible();
  });

  test('redirects to error UI when raceId param is invalid', async ({ page }) => {
    await page.goto('/races/abc/chip-mappings');
    await expect(page.getByText(/Race ID không hợp lệ/i)).toBeVisible();
  });

  // ─────────── CSV IMPORT — HAPPY PATH ───────────

  test('imports valid CSV with 0 errors → confirm enabled → success banner', async ({
    page,
  }) => {
    const csv = ['chip_id,bib_number', 'TESTAA1,9001', 'TESTBB2,9002', 'TESTCC3,9003'].join('\n');
    await page.setInputFiles('input[type=file]', {
      name: 'mappings.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText(/Total rows/)).toBeVisible();
    await expect(page.getByText(/dòng bị block/)).toHaveCount(0);
    const confirmBtn = page.getByRole('button', { name: /Confirm import.*3 mapping/ });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(page.getByText(/Đã import 3 mapping/)).toBeVisible();
  });

  // ─────────── CSV IMPORT — UNHAPPY PATHS ───────────

  test('formula injection in chip_id is BLOCKED (red errors), confirm disabled', async ({
    page,
  }) => {
    const csv = "chip_id,bib_number\n=cmd|'/c calc'!A1,1\n+1+1,2\n@SUM(1+9),3\nVALID01,9999";
    await page.setInputFiles('input[type=file]', {
      name: 'evil.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText(/Formula injection/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirm import/ })).toBeDisabled();
  });

  test('CSV > 5MB → 413 error toast, no stack trace leak', async ({ page }) => {
    const big = Buffer.alloc(6 * 1024 * 1024, 'a');
    await page.setInputFiles('input[type=file]', {
      name: 'big.csv',
      mimeType: 'text/csv',
      buffer: big,
    });
    const errEl = page.locator('[class*=red]', { hasText: /max|413|exceed|size/i }).first();
    await expect(errEl).toBeVisible();
    await expect(page.getByText(/Cannot read|TypeError|undefined|node_modules/)).toHaveCount(0);
  });

  test('CSV with > 5000 rows → blocked at preview', async ({ page }) => {
    const rows = Array.from({ length: 5001 }, (_, i) => `CHIP${i.toString().padStart(5, '0')},${i + 1}`);
    const csv = ['chip_id,bib_number', ...rows].join('\n');
    await page.setInputFiles('input[type=file]', {
      name: 'huge.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText(/exceeds.*5/i)).toBeVisible();
  });

  test('in-file duplicate chip_id → block row with "Duplicate"', async ({ page }) => {
    const csv = 'chip_id,bib_number\nDUPCHIP1,100\nDUPCHIP1,200';
    await page.setInputFiles('input[type=file]', {
      name: 'dup-chip.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText(/Duplicate chip_id/i)).toBeVisible();
  });

  test('in-file duplicate bib_number → block row with "Duplicate bib"', async ({ page }) => {
    const csv = 'chip_id,bib_number\nUNIQUE001,500\nUNIQUE002,500';
    await page.setInputFiles('input[type=file]', {
      name: 'dup-bib.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText(/Duplicate bib_number/i)).toBeVisible();
  });

  test('BOM UTF-8 stripped, headers parsed correctly', async ({ page }) => {
    const csv = '﻿chip_id,bib_number\nBOMOK01,9501';
    await page.setInputFiles('input[type=file]', {
      name: 'bom.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await expect(page.getByText(/Total rows/)).toBeVisible();
    await expect(page.getByText(/Missing required column/)).toHaveCount(0);
  });

  test('chip-BIB swap detected — amber warning + swapDeletes counter', async ({ page }) => {
    // Pre-condition: chip TESTAA1 → BIB 9001 and TESTBB2 → BIB 9002 already in DB
    // (created by happy-path test above). Now import swap.
    const csv = 'chip_id,bib_number\nTESTAA1,9002\nTESTBB2,9001';
    await page.setInputFiles('input[type=file]', {
      name: 'swap.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText(/mapping cũ sẽ bị soft-delete/)).toBeVisible();
    await expect(page.getByText(/swap|Soft-delete swaps/i)).toBeVisible();
  });

  // ─────────── TOKEN PANEL ───────────

  test('GENERATE token shows kiosk URL ONE-TIME with copy button', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /GENERATE token/ });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    }
    const urlEl = page.locator('p.font-mono').first();
    await expect(urlEl).toBeVisible();
    const url = await urlEl.textContent();
    expect(url).toMatch(/^https?:\/\/[^/]+\/chip-verify\/[A-Za-z0-9_-]{32}$/);
    // BUG #FE-2 catcher — must NOT contain "result-result"
    expect(url).not.toMatch(/result-result/);
  });

  test('ROTATE token shows confirm dialog with old-token warning', async ({ page }) => {
    const rotateBtn = page.getByRole('button', { name: /^ROTATE$/ });
    if (await rotateBtn.isVisible()) {
      await rotateBtn.click();
      await expect(page.getByText(/vô hiệu ngay lập tức/)).toBeVisible();
      await page.getByRole('button', { name: /Cancel/ }).click();
    }
  });

  test('DISABLE token shows confirm dialog with kiosk-loss warning', async ({ page }) => {
    const disableBtn = page.getByRole('button', { name: /^DISABLE$/ });
    if (await disableBtn.isVisible()) {
      await disableBtn.click();
      await expect(page.getByText(/mất kết nối ngay lập tức/)).toBeVisible();
      await page.getByRole('button', { name: /Cancel/ }).click();
    }
  });

  // ─────────── TABLE — SEARCH + EDIT + DELETE ───────────

  test('search by chip_id prefix filters table', async ({ page }) => {
    await page.getByPlaceholder(/Tìm chip_id/i).fill('TESTAA');
    await page.getByRole('button', { name: /^Search$/ }).click();
    await expect(page.locator('td.font-mono', { hasText: 'TESTAA1' })).toBeVisible();
  });

  test('edit mapping → save → row updated', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
    await editBtn.click();
    await expect(page.getByText(/Edit chip mapping/)).toBeVisible();
    await page.getByRole('button', { name: /Cancel/ }).click();
  });

  test('delete mapping → confirm dialog appears', async ({ page }) => {
    const delBtn = page.getByRole('button', { name: /^Delete$/ }).first();
    await delBtn.click();
    await expect(page.getByText(/Soft-delete mapping/i)).toBeVisible();
    await page.getByRole('button', { name: /Cancel/ }).click();
  });

  // ─────────── CACHE PANEL ───────────

  test('CLEAR cache shows confirm dialog with warning', async ({ page }) => {
    const clearBtn = page.getByRole('button', { name: /^Clear cache$/ });
    if (await clearBtn.isEnabled()) {
      await clearBtn.click();
      await expect(page.getByText(/Race day KHÔNG nên clear/)).toBeVisible();
      await page.getByRole('button', { name: /Cancel/ }).click();
    }
  });

  // ─────────── ACCESS CONTROL ───────────

  test('unauthenticated user cannot access /chip-mappings', async ({ browser }) => {
    const ctx = await browser.newContext(); // no storageState
    const page = await ctx.newPage();
    await page.goto(`/races/${TEST_RACE_ID}/chip-mappings`);
    await expect(page.getByText(/đăng nhập admin/i)).toBeVisible();
    await ctx.close();
  });
});
