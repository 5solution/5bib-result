/**
 * F-024 E2E Test Script — Contract Management
 *
 * Bootstrap Nest application context → call services directly (bypass HTTP/guard).
 * Tests: TIMING full flow + RACEKIT + OPERATIONS + TICKET_SALES minimal.
 *
 * Run: cd backend && npx ts-node -r tsconfig-paths/register scripts/e2e-f024-contract-management.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/modules/app.module';
import { PartnersService } from '../src/modules/contracts/services/partners.service';
import { ContractsService } from '../src/modules/contracts/services/contracts.service';
import { getModelToken } from '@nestjs/mongoose';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = '/tmp/E2E-F024-v2';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const results: Array<{ step: string; status: 'PASS' | 'FAIL'; note: string; file?: string; size?: number }> = [];

function record(step: string, status: 'PASS' | 'FAIL', note: string, file?: string) {
  let size: number | undefined;
  if (file && fs.existsSync(file)) size = fs.statSync(file).size;
  results.push({ step, status, note, file, size });
  console.log(`[${status}] ${step} — ${note}${file ? ` → ${file} (${size} B)` : ''}`);
}

async function main() {
  console.log('=== F-024 E2E Test — bootstrapping Nest app context ===');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const partners = app.get(PartnersService);
  const contracts = app.get(ContractsService);
  const contractModel = app.get(getModelToken('Contract'));

  // ---------- SETUP: tạo Partner test ----------
  let partnerId: string;
  try {
    const partner = await partners.create({
      entityName: 'CÔNG TY TNHH XYZ Test 5BIB',
      shortName: 'XYZ',
      taxId: '0123456789',
      representative: 'Nguyễn Văn A',
      position: 'Giám đốc',
      address: 'Số 1, Phố ABC, Quận Hoàn Kiếm, Hà Nội',
      bankAccount: '1234567890',
      bankName: 'Vietcombank CN HN',
      phone: '0987654321',
      email: 'lien.he@xyz.vn',
    } as any);
    partnerId = String((partner as any)._id);
    record('Setup: Partner created', 'PASS', `partnerId=${partnerId}`);
  } catch (e: any) {
    record('Setup: Partner created', 'FAIL', e.message);
    await app.close();
    return;
  }

  const lineItemsTiming = [
    { stt: 1, description: 'Chip tính giờ (single-use)', unit: 'chip', quantity: 1000, unitPrice: 50000 },
    { stt: 2, description: 'Cổng Start/Finish + hệ thống đo', unit: 'bộ', quantity: 1, unitPrice: 50000000 },
    { stt: 3, description: 'Nhân sự vận hành tính giờ tại race-day', unit: 'ngày công', quantity: 10, unitPrice: 8518518 },
  ];

  // ---------- TEST 1: TIMING full flow ----------
  console.log('\n=== TEST 1: TIMING full flow ===');

  // 1.1 Quotation
  let quotationId: string | undefined;
  try {
    const q = await contracts.create(
      {
        contractType: 'TIMING',
        documentType: 'QUOTATION',
        providerId: '5BIB',
        partnerId,
        client: {
          entityName: 'CÔNG TY TNHH XYZ Test 5BIB',
          taxId: '0123456789',
          representative: 'Nguyễn Văn A',
          position: 'Giám đốc',
          address: 'Số 1, Phố ABC, Quận Hoàn Kiếm, Hà Nội',
        },
        raceName: 'Giải chạy Mẫu Sơn 2026',
        raceDate: '06:00 ngày 15/06/2026',
        raceLocation: 'Khu DL Mẫu Sơn, Lạng Sơn',
        lineItems: lineItemsTiming,
        vatRate: 8,
        paymentTerms: { advancePercentage: 50 },
      } as any,
      'e2e-test',
    );
    quotationId = String((q as any)._id);
    record('1.1 TIMING Quotation created', 'PASS', `id=${quotationId} totalAmount=${(q as any).totalAmount}`);
  } catch (e: any) {
    record('1.1 TIMING Quotation created', 'FAIL', e.message);
  }

  // 1.2 Generate Quotation Excel
  if (quotationId) {
    try {
      const r = await contracts.generateDocument(quotationId, 'QUOTATION', 'e2e-test');
      const dl = await contracts.downloadDocument(quotationId, r.docxKey);
      const outFile = path.join(OUT_DIR, '01-quotation-timing.xlsx');
      fs.writeFileSync(outFile, dl.body);
      record('1.2 Quotation Excel rendered', 'PASS', `key=${r.docxKey} ct=${dl.contentType}`, outFile);
    } catch (e: any) {
      record('1.2 Quotation Excel rendered', 'FAIL', e.message);
    }
  }

  // 1.3 Convert Quotation → Contract (cần ACCEPTED trước)
  let contractId: string | undefined;
  if (quotationId) {
    try {
      // BUG-001 RESOLVED — sử dụng endpoint mới acceptQuotation thay direct DB update.
      const accepted = await contracts.acceptQuotation(quotationId, 'e2e-test');
      record(
        '1.3a Quotation → ACCEPTED (via acceptQuotation API)',
        'PASS',
        `status=${(accepted as any).status}`,
      );
      const c = await contracts.convertQuotation(quotationId, 'e2e-test');
      contractId = String((c as any)._id);
      record('1.3 Convert Quotation → Contract', 'PASS', `contractId=${contractId} status=${(c as any).status}`);
    } catch (e: any) {
      record('1.3 Convert Quotation → Contract', 'FAIL', e.message);
    }
  }

  // 1.4 Activate Contract
  if (contractId) {
    try {
      const c = await contracts.activate(contractId);
      record(
        '1.4 Activate Contract',
        'PASS',
        `status=${(c as any).status} contractNumber=${(c as any).contractNumber}`,
      );
    } catch (e: any) {
      record('1.4 Activate Contract', 'FAIL', e.message);
    }
  }

  // 1.5 Generate Contract DOCX
  if (contractId) {
    try {
      const r = await contracts.generateDocument(contractId, 'CONTRACT', 'e2e-test');
      const dl = await contracts.downloadDocument(contractId, r.docxKey);
      const outFile = path.join(OUT_DIR, '02-contract-timing.docx');
      fs.writeFileSync(outFile, dl.body);
      record('1.5 Contract TIMING DOCX rendered', 'PASS', `ct=${dl.contentType}`, outFile);
      // 1.6 PDF
      if (r.pdfKey) {
        try {
          const dlpdf = await contracts.downloadDocument(contractId, r.pdfKey);
          const outPdf = path.join(OUT_DIR, '03-contract-timing.pdf');
          fs.writeFileSync(outPdf, dlpdf.body);
          record('1.6 Contract TIMING PDF rendered', 'PASS', `ct=${dlpdf.contentType}`, outPdf);
        } catch (e: any) {
          record('1.6 Contract TIMING PDF rendered', 'FAIL', e.message);
        }
      } else {
        record('1.6 Contract TIMING PDF rendered', 'FAIL', 'No pdfKey returned from generateDocument');
      }
    } catch (e: any) {
      record('1.5 Contract TIMING DOCX rendered', 'FAIL', e.message);
    }
  }

  // 1.7 Acceptance Report
  if (contractId) {
    try {
      const c = await contracts.upsertAcceptanceReport(contractId, {
        actualValues: [
          { stt: 1, description: lineItemsTiming[0].description, unit: 'chip', quantity: 1000, unitPrice: 50000 },
          { stt: 2, description: lineItemsTiming[1].description, unit: 'bộ', quantity: 1, unitPrice: 50000000 },
          { stt: 3, description: lineItemsTiming[2].description, unit: 'ngày công', quantity: 11, unitPrice: 8518518 },
        ],
        verdict: 'ACCEPTED_WITH_NOTES',
        notes: 'Phát sinh 1 ngày công nhân sự',
      } as any);
      record('1.7 Acceptance Report upserted', 'PASS', `diffAmount=${(c as any).acceptanceReport?.diffAmount ?? 'n/a'}`);
    } catch (e: any) {
      record('1.7 Acceptance Report upserted', 'FAIL', e.message);
    }
  }

  // 1.8 Generate Acceptance DOCX
  if (contractId) {
    try {
      const r = await contracts.generateDocument(contractId, 'ACCEPTANCE_REPORT', 'e2e-test');
      const dl = await contracts.downloadDocument(contractId, r.docxKey);
      const outFile = path.join(OUT_DIR, '04-acceptance-timing.docx');
      fs.writeFileSync(outFile, dl.body);
      record('1.8 Acceptance TIMING DOCX rendered', 'PASS', `ct=${dl.contentType}`, outFile);
    } catch (e: any) {
      record('1.8 Acceptance TIMING DOCX rendered', 'FAIL', e.message);
    }
  }

  // 1.9 Finalize Acceptance
  if (contractId) {
    try {
      const c = await contracts.finalizeAcceptanceReport(contractId);
      record('1.9 Finalize Acceptance', 'PASS', `finalizedAt=${(c as any).acceptanceReport?.finalizedAt}`);
    } catch (e: any) {
      record('1.9 Finalize Acceptance', 'FAIL', e.message);
    }
  }

  // 1.10 Payment Request
  if (contractId) {
    try {
      const c = await contracts.upsertPaymentRequest(contractId, {
        notes: 'Đề nghị thanh toán đợt 2 sau nghiệm thu',
      } as any);
      record('1.10 Payment Request upserted', 'PASS', `amountDue=${(c as any).paymentRequest?.amountDue}`);
    } catch (e: any) {
      record('1.10 Payment Request upserted', 'FAIL', e.message);
    }
  }

  // 1.11 Generate Payment Request DOCX
  if (contractId) {
    try {
      const r = await contracts.generateDocument(contractId, 'PAYMENT_REQUEST', 'e2e-test');
      const dl = await contracts.downloadDocument(contractId, r.docxKey);
      const outFile = path.join(OUT_DIR, '05-payment-timing.docx');
      fs.writeFileSync(outFile, dl.body);
      record('1.11 Payment Request DOCX rendered', 'PASS', `ct=${dl.contentType}`, outFile);
    } catch (e: any) {
      record('1.11 Payment Request DOCX rendered', 'FAIL', e.message);
    }
  }

  // ---------- TEST 2: RACEKIT minimal ----------
  console.log('\n=== TEST 2: RACEKIT minimal flow ===');
  let racekitId: string | undefined;
  try {
    const c = await contracts.create(
      {
        contractType: 'RACEKIT',
        documentType: 'CONTRACT',
        providerId: '5BIB',
        partnerId,
        client: {
          entityName: 'CÔNG TY TNHH XYZ Test 5BIB',
          taxId: '0123456789',
          representative: 'Nguyễn Văn A',
          position: 'Giám đốc',
          address: 'Số 1, Phố ABC, Quận Hoàn Kiếm, Hà Nội',
        },
        raceName: 'Giải chạy Test RACEKIT',
        raceDate: '15/06/2026',
        raceLocation: 'Hà Nội',
        lineItems: [
          { stt: 1, description: 'Bib + Áo race-kit (1000 VĐV)', unit: 'set', quantity: 1000, unitPrice: 150000 },
        ],
        vatRate: 8,
      } as any,
      'e2e-test',
    );
    racekitId = String((c as any)._id);
    record('2.1 RACEKIT Contract created', 'PASS', `id=${racekitId}`);
    await contracts.activate(racekitId);
    const r = await contracts.generateDocument(racekitId, 'CONTRACT', 'e2e-test');
    const dl = await contracts.downloadDocument(racekitId, r.docxKey);
    const outFile = path.join(OUT_DIR, '06-contract-racekit.docx');
    fs.writeFileSync(outFile, dl.body);
    record('2.2 RACEKIT Contract DOCX rendered', 'PASS', `ct=${dl.contentType}`, outFile);
  } catch (e: any) {
    record('2.x RACEKIT', 'FAIL', e.message);
  }

  // ---------- TEST 3: OPERATIONS minimal ----------
  console.log('\n=== TEST 3: OPERATIONS minimal flow ===');
  try {
    const c = await contracts.create(
      {
        contractType: 'OPERATIONS',
        documentType: 'CONTRACT',
        providerId: '5SOLUTION',
        partnerId,
        client: {
          entityName: 'CÔNG TY TNHH XYZ Test 5BIB',
          taxId: '0123456789',
          representative: 'Nguyễn Văn A',
          position: 'Giám đốc',
          address: 'Số 1, Phố ABC, Quận Hoàn Kiếm, Hà Nội',
        },
        raceName: 'Giải chạy Test OPERATIONS',
        raceDate: '15/06/2026',
        raceLocation: 'Hà Nội',
        lineItems: [
          { stt: 1, description: 'Vận hành race-day toàn diện', unit: 'gói', quantity: 1, unitPrice: 300000000 },
        ],
        vatRate: 8,
      } as any,
      'e2e-test',
    );
    const opsId = String((c as any)._id);
    record('3.1 OPERATIONS Contract created', 'PASS', `id=${opsId}`);
    await contracts.activate(opsId);
    const r = await contracts.generateDocument(opsId, 'CONTRACT', 'e2e-test');
    const dl = await contracts.downloadDocument(opsId, r.docxKey);
    const outFile = path.join(OUT_DIR, '07-contract-operations.docx');
    fs.writeFileSync(outFile, dl.body);
    record('3.2 OPERATIONS Contract DOCX rendered', 'PASS', `ct=${dl.contentType}`, outFile);
  } catch (e: any) {
    record('3.x OPERATIONS', 'FAIL', e.message);
  }

  // ---------- TEST 4: TICKET_SALES (revenue share, no BBNT) ----------
  console.log('\n=== TEST 4: TICKET_SALES revenue share ===');
  // Tạo partner thứ 2 để tránh contract number conflict (race condition cùng day same partner)
  const partner2 = await partners.create({
    entityName: 'CÔNG TY TNHH ABC Test 5BIB',
    shortName: 'ABC',
    taxId: '0987654321',
    representative: 'Lê Văn C',
    position: 'Tổng giám đốc',
    address: 'Số 99 Đường XYZ, Quận 1, TP.HCM',
  } as any);
  const partner2Id = String((partner2 as any)._id);
  let ticketId: string | undefined;
  try {
    const c = await contracts.create(
      {
        contractType: 'TICKET_SALES',
        documentType: 'CONTRACT',
        providerId: '5BIB',
        partnerId: partner2Id,
        client: {
          entityName: 'CÔNG TY TNHH ABC Test 5BIB',
          taxId: '0987654321',
          representative: 'Lê Văn C',
          position: 'Tổng giám đốc',
          address: 'Số 99 Đường XYZ, Quận 1, TP.HCM',
        },
        raceName: 'Giải chạy Test TICKET_SALES',
        raceDate: '15/06/2026',
        raceLocation: 'Hà Nội',
        revenueShare: {
          feePercentage: 6,
          feePerAthlete: 10000,
          estimatedAthletes: 500,
        },
        vatRate: 0,
      } as any,
      'e2e-test',
    );
    ticketId = String((c as any)._id);
    record('4.1 TICKET_SALES Contract created', 'PASS', `id=${ticketId}`);
    await contracts.activate(ticketId);
    const r = await contracts.generateDocument(ticketId, 'CONTRACT', 'e2e-test');
    const dl = await contracts.downloadDocument(ticketId, r.docxKey);
    const outFile = path.join(OUT_DIR, '08-contract-ticket-sales.docx');
    fs.writeFileSync(outFile, dl.body);
    record('4.2 TICKET_SALES Contract DOCX rendered', 'PASS', `ct=${dl.contentType}`, outFile);
  } catch (e: any) {
    record('4.x TICKET_SALES create/gen', 'FAIL', e.message);
  }

  // 4.3 Acceptance Report must be blocked
  if (ticketId) {
    try {
      await contracts.upsertAcceptanceReport(ticketId, { actualValues: [], verdict: 'ACCEPTED' } as any);
      record('4.3 TICKET_SALES BBNT block', 'FAIL', 'Service đã CHO PHÉP upsertAcceptanceReport — leak BR-CM rule');
    } catch (e: any) {
      record('4.3 TICKET_SALES BBNT block', 'PASS', `Blocked: ${e.message}`);
    }
    try {
      await contracts.generateDocument(ticketId, 'ACCEPTANCE_REPORT', 'e2e-test');
      record('4.4 TICKET_SALES BBNT generate block', 'FAIL', 'generateDocument đã render BBNT cho TICKET_SALES');
    } catch (e: any) {
      record('4.4 TICKET_SALES BBNT generate block', 'PASS', `Blocked: ${e.message}`);
    }
  }

  // 4.5 Quotation Excel cho TICKET_SALES
  if (ticketId) {
    try {
      const r = await contracts.generateDocument(ticketId, 'QUOTATION', 'e2e-test');
      const dl = await contracts.downloadDocument(ticketId, r.docxKey);
      const outFile = path.join(OUT_DIR, '09-quotation-ticket-sales.xlsx');
      fs.writeFileSync(outFile, dl.body);
      record('4.5 TICKET_SALES Quotation Excel', 'PASS', `ct=${dl.contentType}`, outFile);
    } catch (e: any) {
      record('4.5 TICKET_SALES Quotation Excel', 'FAIL', e.message);
    }
  }

  await app.close();
  console.log('\n=== Summary ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`PASS: ${pass} / FAIL: ${fail}`);
  fs.writeFileSync(path.join(OUT_DIR, '00-results.json'), JSON.stringify(results, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
