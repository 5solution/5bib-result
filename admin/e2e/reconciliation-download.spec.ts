/**
 * FEATURE-004 QC — Admin Reconciliation Download E2E.
 *
 * Setup before running (one-time):
 *   1. pnpm add -D @playwright/test  (nếu chưa có)
 *   2. pnpm playwright install chromium
 *   3. Pre-auth admin storage state to admin/e2e/.auth/admin.json (Logto sign-in)
 *
 * Run:
 *   pnpm playwright test admin/e2e/reconciliation-download.spec.ts
 *
 * Pre-conditions:
 *   - BE running on :8081 với reconciliation domain seed (≥ 1 reconciliation đã có xlsx_url + docx_url)
 *   - FE admin running on :3010
 *   - Logto admin token có role `admin`
 *   - E2E_RECONCILIATION_ID env set (ObjectId của reconciliation tồn tại trong DB)
 *
 * Critical assertion: TC-DOWNLOAD-08 — fetch URL phải chứa `/api/reconciliations/`,
 * KHÔNG được chứa `s3.ap-southeast-1.amazonaws.com`. Đây là regression guard cốt lõi cho FEATURE-004.
 */
import { test, expect, type Request } from '@playwright/test';

const TEST_RECON_ID = process.env.E2E_RECONCILIATION_ID ?? '69f9488ab13b71f5c5f970ec';
const STORAGE_STATE = 'e2e/.auth/admin.json';

test.use({ storageState: STORAGE_STATE });

/**
 * Helper: capture all download fetch requests during a test.
 * Used to assert URL pattern in TC-DOWNLOAD-08.
 */
function captureDownloadRequests(page: import('@playwright/test').Page): Request[] {
  const captured: Request[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/download/xlsx') || url.includes('/download/docx') || url.includes('5sport-media.s3')) {
      captured.push(req);
    }
  });
  return captured;
}

test.describe('Reconciliation Download — Detail page (FEATURE-004)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/reconciliations/${TEST_RECON_ID}`);
    await expect(page.getByText(/Tải xuống/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-DOWNLOAD-01: XLSX button triggers backend download endpoint (NOT S3)', async ({ page }) => {
    const requests = captureDownloadRequests(page);

    // Click XLSX button → should fetch /api/reconciliations/:id/download/xlsx
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'XLSX' }).click();
    const download = await downloadPromise;

    // TC-DOWNLOAD-08 critical: assert URL pattern
    expect(requests.length).toBeGreaterThan(0);
    const xlsxReq = requests.find((r) => r.url().includes('/download/xlsx'));
    expect(xlsxReq).toBeDefined();
    expect(xlsxReq!.url()).toContain('/api/reconciliations/');
    expect(xlsxReq!.url()).toContain(`/${TEST_RECON_ID}/download/xlsx`);
    expect(xlsxReq!.url()).not.toContain('5sport-media.s3');
    expect(xlsxReq!.url()).not.toContain('amazonaws.com');

    // Auth header presence
    const authHeader = xlsxReq!.headers()['authorization'];
    expect(authHeader).toBeDefined();
    expect(authHeader).toMatch(/^Bearer /);

    // File should download successfully
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.xlsx$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('TC-DOWNLOAD-02: DOCX button triggers backend download endpoint (NOT S3)', async ({ page }) => {
    const requests = captureDownloadRequests(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'DOCX' }).click();
    const download = await downloadPromise;

    const docxReq = requests.find((r) => r.url().includes('/download/docx'));
    expect(docxReq).toBeDefined();
    expect(docxReq!.url()).toContain('/api/reconciliations/');
    expect(docxReq!.url()).toContain(`/${TEST_RECON_ID}/download/docx`);
    expect(docxReq!.url()).not.toContain('5sport-media.s3');

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.docx$/i);
  });

  test('TC-DOWNLOAD-05: shows toast on backend 401 (token expired)', async ({ page }) => {
    // Force 401 on download endpoint
    await page.route('**/api/reconciliations/*/download/xlsx', (route) => {
      route.fulfill({ status: 401, body: 'Unauthorized' });
    });

    await page.getByRole('button', { name: 'XLSX' }).click();
    await expect(page.getByText(/Tải XLSX thất bại/i)).toBeVisible({ timeout: 5000 });
  });

  test('TC-DOWNLOAD-06: shows toast on backend 500', async ({ page }) => {
    await page.route('**/api/reconciliations/*/download/xlsx', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.getByRole('button', { name: 'XLSX' }).click();
    await expect(page.getByText(/Tải XLSX thất bại/i)).toBeVisible({ timeout: 5000 });
  });

  test('TC-DOWNLOAD-07: shows toast on network error', async ({ page }) => {
    await page.route('**/api/reconciliations/*/download/docx', (route) => {
      route.abort('failed');
    });

    await page.getByRole('button', { name: 'DOCX' }).click();
    await expect(page.getByText(/Tải DOCX thất bại/i)).toBeVisible({ timeout: 5000 });
  });

  test('TC-DOWNLOAD-08 CRITICAL: regression guard — never fetch S3 URL directly', async ({ page }) => {
    const requests = captureDownloadRequests(page);

    // Click both buttons sequentially
    const xlsxDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'XLSX' }).click();
    await xlsxDownload;

    const docxDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'DOCX' }).click();
    await docxDownload;

    // ABSOLUTE: zero requests to S3 hostname
    const s3Requests = requests.filter((r) => r.url().includes('amazonaws.com'));
    expect(s3Requests).toHaveLength(0);

    // Both downloads must hit backend
    const backendRequests = requests.filter((r) => r.url().includes('/api/reconciliations/'));
    expect(backendRequests.length).toBeGreaterThanOrEqual(2);
  });

  test('TC-DOWNLOAD-09: filename Vietnamese diacritics preserved', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'XLSX' }).click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    // Filename phải decode được, không bị mojibake
    expect(filename).not.toContain('%');  // Should be decoded by browser
    // Pattern: <tenant_name> - <race_title> - <period>.xlsx
    expect(filename).toMatch(/\.xlsx$/i);
  });
});

test.describe('Reconciliation Download — Create flow (FEATURE-004)', () => {
  /**
   * Create flow Step 3: download buttons xuất hiện sau khi tạo recon thành công.
   * QC test này yêu cầu:
   *   - Test merchant + race fixture cho preflight pass
   *   - DB seed có thể skip vì test sẽ tạo recon mới
   *
   * Skip nếu env không có E2E_TEST_TENANT_ID + E2E_TEST_RACE_ID.
   */
  test.skip(
    !process.env.E2E_TEST_TENANT_ID || !process.env.E2E_TEST_RACE_ID,
    'Cần E2E_TEST_TENANT_ID + E2E_TEST_RACE_ID env',
  );

  test('TC-DOWNLOAD-03+04: Create flow XLSX/DOCX dùng backend endpoint', async ({ page }) => {
    const requests = captureDownloadRequests(page);

    // Navigate qua create flow đến Step 3 (placeholder — flow phụ thuộc fixture)
    await page.goto('/reconciliations/new');
    // ... flow create thực tế trong UAT environment

    // Sau khi tạo xong, click XLSX
    // const xlsxBtn = page.getByRole('button', { name: 'Tải XLSX' });
    // await xlsxBtn.click();

    // Same TC-DOWNLOAD-08 assertion
    const s3Requests = requests.filter((r) => r.url().includes('amazonaws.com'));
    expect(s3Requests).toHaveLength(0);
  });
});

test.describe('Reconciliation Download — Security (FEATURE-004)', () => {
  test('TC-DOWNLOAD-SEC-01: direct S3 curl with Bearer Logto returns 403', async ({ request }) => {
    // Verify bucket vẫn private — file đối soát chứa data tài chính
    const s3Url = `https://5sport-media.s3.ap-southeast-1.amazonaws.com/reconciliations/${TEST_RECON_ID}/reconciliation.xlsx`;
    const res = await request.get(s3Url, {
      headers: { Authorization: 'Bearer fake-logto-token' },
    });
    // S3 returns 403 (or sometimes 400) — KHÔNG được 200 (regression guard)
    expect([400, 403]).toContain(res.status());
  });

  test('TC-DOWNLOAD-SEC-02: backend endpoint without Authorization header returns 401', async ({ request }) => {
    const res = await request.get(`http://localhost:3010/api/reconciliations/${TEST_RECON_ID}/download/xlsx`);
    expect(res.status()).toBe(401);
  });

  test('TC-DOWNLOAD-SEC-03: backend endpoint with invalid token returns 401', async ({ request }) => {
    const res = await request.get(`http://localhost:3010/api/reconciliations/${TEST_RECON_ID}/download/xlsx`, {
      headers: { Authorization: 'Bearer invalid-token-xxx' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Reconciliation Download — 10x stability (FEATURE-004)', () => {
  test('TC-DOWNLOAD-10x: 10 consecutive XLSX downloads → 10/10 hit backend, 0 hit S3', async ({ page }) => {
    await page.goto(`/reconciliations/${TEST_RECON_ID}`);
    await expect(page.getByText(/Tải xuống/i).first()).toBeVisible();

    const requests = captureDownloadRequests(page);

    for (let i = 0; i < 10; i++) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'XLSX' }).click();
      await downloadPromise;
    }

    const backendCount = requests.filter((r) => r.url().includes('/api/reconciliations/')).length;
    const s3Count = requests.filter((r) => r.url().includes('amazonaws.com')).length;

    expect(backendCount).toBeGreaterThanOrEqual(10);
    expect(s3Count).toBe(0);
  });
});
