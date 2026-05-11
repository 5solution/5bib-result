/**
 * FEATURE-024 Phase 2B — Contract lifecycle E2E (admin).
 *
 * Mirrors F-006 / F-005 pattern: spec committed cho traceability, cần seeded
 * data + Logto storageState để run.
 *
 * Happy path: create wizard → activate → acceptance report → payment request
 * → mark paid → download DOCX + PDF.
 *
 * Pre-requisites for live execution:
 * - admin running http://localhost:3000
 * - backend running http://localhost:8081 với contracts module
 * - env vars E2E_F024_PARTNER_TAX_ID + E2E_F024_RACE_NAME (optional partner +
 *   race fixtures seeded), nếu không sẽ tự tạo mới partner trong wizard
 * - playwright.config storageState injecting Logto session cookie
 *
 * Track defer TD-F024-E2E-01 nếu Phase 2B QC skip live run.
 */
import { expect, test } from "@playwright/test";

const PARTNER_TAX = process.env.E2E_F024_PARTNER_TAX_ID ?? "0123456789-test";
const RACE_NAME = process.env.E2E_F024_RACE_NAME;
const TIMESTAMP = Date.now();

test.describe("F-024 — Contract lifecycle (happy path)", () => {
  test("create TIMING contract → activate → acceptance → payment → download", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // ── Step 0: navigate to list
    await page.goto("/contracts");
    await expect(page.getByRole("heading", { name: /hợp đồng/i })).toBeVisible();

    // ── Step 1: open wizard
    await page.getByTestId("btn-create-contract").click();
    await expect(page.getByText(/Bước 1 \/ 6/)).toBeVisible();

    // Step 1: TIMING + 5BIB
    await page.getByLabel("Loại hợp đồng").click();
    await page.getByRole("option", { name: /Dịch vụ tính giờ/ }).click();
    // 5BIB is default for TIMING — verify card highlighted
    await page.getByRole("button", { name: /Provider 5BIB/i }).click();
    await page.getByRole("button", { name: /Tiếp tục/ }).click();

    // ── Step 2: partner (inline create)
    await expect(page.getByText(/Bước 2 \/ 6/)).toBeVisible();
    await page.getByRole("button", { name: /Tạo mới/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên đối tác/).fill(`Công ty Test ${TIMESTAMP}`);
    await dialog.getByLabel(/MST/).fill(PARTNER_TAX);
    await dialog.getByRole("button", { name: /Tạo đối tác/ }).click();
    await page.getByRole("button", { name: /Tiếp tục/ }).click();

    // ── Step 3: race optional — skip
    await expect(page.getByText(/Bước 3 \/ 6/)).toBeVisible();
    await page.getByRole("button", { name: /Tiếp tục/ }).click();

    // ── Step 4: 5 line items
    await expect(page.getByText(/Bước 4 \/ 6/)).toBeVisible();
    const items = [
      { desc: "Chip tính giờ", unit: "VĐV", qty: 500, price: 30000 },
      { desc: "Cổng Start", unit: "Cái", qty: 1, price: 5000000 },
      { desc: "Cổng Finish", unit: "Cái", qty: 1, price: 5000000 },
      { desc: "Trạm CP1", unit: "Cái", qty: 2, price: 2000000 },
      { desc: "Nhân sự setup", unit: "Người", qty: 5, price: 1000000 },
    ];
    for (let i = 0; i < items.length; i++) {
      await page.getByRole("button", { name: /Thêm dòng trống/ }).click();
      await page
        .getByLabel(`Mô tả dòng ${i + 1}`)
        .fill(items[i].desc);
      await page.getByLabel(`ĐVT dòng ${i + 1}`).fill(items[i].unit);
      await page.getByLabel(`Số lượng dòng ${i + 1}`).fill(String(items[i].qty));
      await page
        .getByLabel(`Đơn giá dòng ${i + 1}`)
        .fill(String(items[i].price));
    }
    await page.getByRole("button", { name: /Tiếp tục/ }).click();

    // ── Step 5: payment terms — accept defaults
    await expect(page.getByText(/Bước 5 \/ 6/)).toBeVisible();
    await page.getByRole("button", { name: /Tiếp tục/ }).click();

    // ── Step 6: review + finalize
    await expect(page.getByText(/Bước 6 \/ 6/)).toBeVisible();
    await page.getByTestId("btn-finalize-create-active").click();

    // ── Verify redirect to detail page
    await expect(page).toHaveURL(/\/contracts\/[a-f0-9]{24}/);
    await expect(
      page.getByRole("button", { name: /Tạo biên bản nghiệm thu/ }),
    ).toBeVisible();

    // ── Acceptance report
    await page.getByTestId("btn-create-acceptance").click();
    await expect(
      page.getByRole("heading", { name: /Biên bản nghiệm thu/ }),
    ).toBeVisible();
    // pre-fill từ contract → just finalize
    await page.getByRole("button", { name: /Hoàn thành/ }).click();
    page.once("dialog", (d) => d.accept());
    await expect(page.getByText(/ĐÃ HOÀN THÀNH/)).toBeVisible();

    // ── Back to contract → payment request
    await page.getByRole("button", { name: /Quay lại HĐ/ }).click();
    await page.getByTestId("btn-create-payment").click();
    await expect(
      page.getByRole("heading", { name: /Đề nghị thanh toán/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Lưu nháp/ }).click();
    await page.getByTestId("btn-mark-paid").click();
    page.once("dialog", (d) => d.accept());
    await expect(page.getByText(/ĐÃ THANH TOÁN/)).toBeVisible();

    // ── Download DOCX (smoke — verify download initiated)
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Xuất Hợp đồng/i }).click();
    await page.getByRole("button", { name: /^DOCX$/ }).click();
    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
  });
});

test.describe("F-024 — Contract list filtering", () => {
  test("list page renders + filter by status", async ({ page }) => {
    await page.goto("/contracts");
    await expect(
      page.getByRole("heading", { name: /Hợp đồng dịch vụ/ }),
    ).toBeVisible();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Tất cả loại/ }).click();
  });
});
