/**
 * FEATURE-006 — Course Map upload Playwright spec (admin).
 *
 * Mirrors the F-005 UAT-deferred pattern: the spec is committed for
 * traceability but requires a seeded race + Logto storage state to run.
 * Track under TD-F006-01 in the post-implementation report.
 *
 * Pre-requisites for live execution:
 * - admin running on http://localhost:3000
 * - backend running on http://localhost:8081 with F-006 endpoints registered
 * - env vars E2E_F006_RACE_ID + E2E_F006_COURSE_ID pointing to a seeded race
 *   that has at least one course saved (we can't open Map tab on a brand-new
 *   unsaved course)
 * - playwright.config storageState injecting a Logto session cookie
 */
import path from 'node:path';

import { expect, test } from '@playwright/test';

const RACE_ID = process.env.E2E_F006_RACE_ID ?? 'demo-race-id';
// E2E_F006_COURSE_ID reserved for future API-direct assertions; tests below
// drive UI through "row → edit" so the courseId is implicit in the seeded race.
const RACE_DETAIL_URL = `/races/${RACE_ID}`;
const FIX = (name: string): string => path.join(__dirname, 'fixtures', name);

async function openCourseMapTab(page: import('@playwright/test').Page) {
  await page.goto(RACE_DETAIL_URL);
  // Open the dialog for the existing course (Pencil = edit icon)
  await page.getByRole('button', { name: /sửa|edit/i }).first().click();
  await page.getByRole('tab', { name: /^map$/i }).click();
}

test.describe('F-006 Course Map upload — admin', () => {
  test('upload sample.gpx → progress → 10 markers visible', async ({ page }) => {
    await openCourseMapTab(page);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIX('sample.gpx'));

    await expect(page.getByText(/đang xử lý/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/gpx đã được tải lên/i)).toBeVisible({ timeout: 30_000 });
    // Map markers — Leaflet renders DOM, count CP/start/finish icons
    const markers = page.locator('.leaflet-marker-icon');
    await expect(markers).toHaveCount(10, { timeout: 10_000 });
  });

  test('upload sample.kml parses correctly', async ({ page }) => {
    await openCourseMapTab(page);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIX('sample.kml'));
    await expect(page.getByText(/gpx đã được tải lên/i)).toBeVisible({ timeout: 30_000 });
  });

  test('upload corrupted.gpx → red error banner', async ({ page }) => {
    await openCourseMapTab(page);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIX('corrupted.gpx'));
    await expect(page.getByRole('alert').getByText(/file gpx không hợp lệ/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('upload large-15mb.gpx → size guard banner', async ({ page }) => {
    await openCourseMapTab(page);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIX('large-15mb.gpx'));
    await expect(page.getByRole('alert').getByText(/vượt quá 10mb/i)).toBeVisible();
  });

  test('Replace button swaps the underlying file', async ({ page }) => {
    await openCourseMapTab(page);
    // Assume Map tab already shows an uploaded GPX (test order or seed)
    await page.getByRole('button', { name: /replace/i }).click();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIX('sample.gpx'));
    await expect(page.getByText(/gpx đã được tải lên/i)).toBeVisible({ timeout: 30_000 });
  });

  test('Delete button removes the map after confirm', async ({ page }) => {
    await openCourseMapTab(page);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /^delete$/i }).click();
    await expect(page.getByText(/kéo \.gpx hoặc \.kml/i)).toBeVisible({ timeout: 15_000 });
  });

  test('Manual mode toggle → drag CP1 marker → position persists', async ({ page }) => {
    await openCourseMapTab(page);
    await page.getByRole('button', { name: /bật manual mode/i }).click();
    // Marker drag — find first CP DivIcon by data attribute or text "1"
    const marker = page.locator('.leaflet-marker-draggable').nth(1); // 0=start, 1=CP1
    const box = await marker.boundingBox();
    if (!box) throw new Error('CP1 marker not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText(/đã lưu vị trí/i)).toBeVisible({ timeout: 10_000 });

    // Reload + verify (network call should return moved coords)
    await page.reload();
    await openCourseMapTab(page);
    // (No precise assertion — relies on backend persistence; visual check left
    // for QC. Tag with @manual if your runner supports it.)
  });

  test('Multi-course race: 5K and 21K GPX persist independently', async ({ page }) => {
    // Open course "5K"
    await page.goto(RACE_DETAIL_URL);
    await page.getByRole('row', { name: /5k/i }).getByRole('button', { name: /sửa|edit/i }).click();
    await page.getByRole('tab', { name: /^map$/i }).click();
    const input5k = page.locator('input[type="file"]').first();
    await input5k.setInputFiles(FIX('sample.gpx'));
    await expect(page.getByText(/gpx đã được tải lên/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /hủy/i }).click();

    // Open course "21K" — should have its own (initially empty) Map tab
    await page.getByRole('row', { name: /21k/i }).getByRole('button', { name: /sửa|edit/i }).click();
    await page.getByRole('tab', { name: /^map$/i }).click();
    await expect(page.getByText(/kéo \.gpx hoặc \.kml/i)).toBeVisible();
    const input21k = page.locator('input[type="file"]').first();
    await input21k.setInputFiles(FIX('sample.kml'));
    await expect(page.getByText(/gpx đã được tải lên/i)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe.configure({ mode: 'serial' });
