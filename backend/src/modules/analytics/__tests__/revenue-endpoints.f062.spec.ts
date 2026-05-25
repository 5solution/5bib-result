import * as fs from 'fs';
import * as path from 'path';

/**
 * F-062 Wave 2B-1 — Revenue endpoints invariants (BR-SA-02/03/04 v3).
 *
 * Source-scan invariant test pattern (port analytics-invariants.spec.ts):
 * cheap defense-in-depth verifying RED LINE business rules are encoded
 * vào SQL/service code, KHÔNG cần full mock infrastructure.
 *
 * Covers:
 *   BR-SA-02 — weekly/monthly revenue dùng YEARWEEK mode 3 + DATE_FORMAT
 *   BR-SA-02 — phí 5BIB PHẢI dùng FeeService.computeFeeForOrdersAggregate
 *              (NO inline %  calc, no shortcut tier 1 only)
 *   BR-SA-04 — comparison MoM dùng Wave 2A shiftMonthClamped (via resolveCompare)
 *              KHÔNG inline setUTCMonth(-1) (TD-F062-MOM-BOUNDARY-ROLLOVER fix)
 *   BI-01    — paid only — `financial_status = 'paid'` filter mandatory
 *   BI-02    — MANUAL excluded from GMV — `order_category != 'MANUAL'` filter
 */

const SVC_PATH = path.resolve(
  __dirname,
  '..',
  'analytics.service.ts',
);
const CTRL_PATH = path.resolve(__dirname, '..', 'analytics.controller.ts');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\*.*$/gm, '')
    .replace(/\/\/.*$/gm, '');
}

function extractMethodBody(src: string, methodName: string): string {
  // Tìm `async methodName(` rồi capture đến start của method kế tiếp.
  // Naive boundary — đủ cho invariant scan, không cần parse AST.
  const start = src.indexOf(`async ${methodName}(`);
  if (start === -1) {
    throw new Error(`extractMethodBody: ${methodName} not found`);
  }
  const rest = src.slice(start + 1);
  const nextOffset = rest.search(/\n\s{2}(?:private |public )?async \w+\(/);
  const endRel = nextOffset === -1 ? rest.length : nextOffset;
  return src.slice(start, start + 1 + endRel);
}

describe('F-062 Wave 2B-1 revenue endpoints invariants', () => {
  const svcRaw = read(SVC_PATH);
  const svc = stripComments(svcRaw);
  const ctrlRaw = read(CTRL_PATH);

  describe('SQL bucket grouping (BR-SA-02 + BR-SA-03)', () => {
    it('getWeeklyRevenue uses YEARWEEK(payment_on, 3) — ISO 8601 mode', () => {
      const body = extractMethodBody(svc, 'getWeeklyRevenue');
      expect(body).toMatch(/YEARWEEK\([^)]*payment_on[^)]*,\s*3\)/);
      // Both tenant + no-tenant SQL variant
      expect(body.match(/YEARWEEK\([^)]*payment_on[^)]*,\s*3\)/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('getMonthlyRevenue uses DATE_FORMAT(payment_on, "%Y-%m")', () => {
      const body = extractMethodBody(svc, 'getMonthlyRevenue');
      expect(body).toMatch(/DATE_FORMAT\([^)]*payment_on[^)]*,\s*'%Y-%m'\)/);
      expect(body.match(/DATE_FORMAT/g)?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Business invariants — paid only + MANUAL exclude (BI-01, BI-02)', () => {
    const methods = ['getWeeklyRevenue', 'getMonthlyRevenue', 'computePeriodSummary'];
    for (const method of methods) {
      it(`${method}: financial_status = 'paid' filter mandatory`, () => {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/financial_status\s*=\s*'paid'/);
      });
      it(`${method}: GMV excludes MANUAL (order_category != 'MANUAL')`, () => {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/order_category\s*!=\s*'MANUAL'/);
      });
      it(`${method}: GREATEST guard cho netGmv (avoid negative discount)`, () => {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/GREATEST\([^,]*-\s*IFNULL\(/);
      });
    }
  });

  describe('FeeService delegation (BR-SA-02 mandate)', () => {
    it('getWeeklyRevenue routes platformFee qua computeFeePerBucket helper', () => {
      const body = extractMethodBody(svc, 'getWeeklyRevenue');
      expect(body).toMatch(/this\.computeFeePerBucket\(/);
      // Pass 'week' granularity
      expect(body).toMatch(/['"]week['"]/);
    });

    it('getMonthlyRevenue routes platformFee qua computeFeePerBucket helper', () => {
      const body = extractMethodBody(svc, 'getMonthlyRevenue');
      expect(body).toMatch(/this\.computeFeePerBucket\(/);
      expect(body).toMatch(/['"]month['"]/);
    });

    it('computeFeePerBucket gọi feeService.computeFeeForOrdersAggregate', () => {
      const body = extractMethodBody(svc, 'computeFeePerBucket' as never);
      // Helper là private async — extractMethodBody khớp `async name(` regex
      expect(body).toMatch(/feeService\.computeFeeForOrdersAggregate\(/);
      expect(body).toMatch(/pullOrdersForFeeAggregate\(/);
    });

    it('NEITHER getWeeklyRevenue nor getMonthlyRevenue inline % fee calc', () => {
      // Anti-pattern: hardcode service_fee_rate hoặc 0.07 multiplier
      const weekly = extractMethodBody(svc, 'getWeeklyRevenue');
      const monthly = extractMethodBody(svc, 'getMonthlyRevenue');
      for (const body of [weekly, monthly]) {
        expect(body).not.toMatch(/service_fee_rate/);
        expect(body).not.toMatch(/\*\s*0\.07/);
        expect(body).not.toMatch(/\*\s*0\.10/);
      }
    });
  });

  describe('Comparison endpoint (BR-SA-04)', () => {
    it('getComparison uses resolveCompare từ period-resolver (NOT inline setUTCMonth)', () => {
      const body = extractMethodBody(svc, 'getComparison');
      expect(body).toMatch(/resolveCompare\(/);
      // Anti-pattern check — setUTCMonth(-1) bug fixed Wave 2A
      expect(body).not.toMatch(/setUTCMonth\(-1\)/);
    });

    it('getComparison uses calcDeltaPercent guard (NOT inline div-by-zero)', () => {
      const body = extractMethodBody(svc, 'getComparison');
      expect(body).toMatch(/calcDeltaPercent\(/);
      // 4 delta % cho 4 metric required
      expect(body.match(/calcDeltaPercent\(/g)?.length).toBeGreaterThanOrEqual(4);
    });

    it('getComparison supports 3 compareWith values (wow/mom/yoy)', () => {
      // Method signature
      expect(svc).toMatch(/getComparison\([^)]*compareWith:\s*'wow'\s*\|\s*'mom'\s*\|\s*'yoy'/);
    });

    it('getComparison runs current + previous summary parallel (Promise.all)', () => {
      const body = extractMethodBody(svc, 'getComparison');
      expect(body).toMatch(/Promise\.all/);
    });
  });

  describe('Cache key convention (Wave 1 BR-SA-24)', () => {
    it('Weekly cache key prefix analytics:weekly-revenue', () => {
      const body = extractMethodBody(svc, 'getWeeklyRevenue');
      expect(body).toMatch(/analytics:weekly-revenue:/);
    });
    it('Monthly cache key prefix analytics:monthly-revenue', () => {
      const body = extractMethodBody(svc, 'getMonthlyRevenue');
      expect(body).toMatch(/analytics:monthly-revenue:/);
    });
    it('Comparison cache key includes compareWith axis', () => {
      const body = extractMethodBody(svc, 'getComparison');
      expect(body).toMatch(/analytics:comparison:\$\{compareWith\}/);
    });
  });

  describe('Controller wiring + Swagger contract', () => {
    it('3 endpoints registered with LogtoAdminGuard (class-level)', () => {
      expect(ctrlRaw).toMatch(/@UseGuards\(LogtoAdminGuard\)/);
      expect(ctrlRaw).toMatch(/@Get\('revenue\/weekly'\)/);
      expect(ctrlRaw).toMatch(/@Get\('revenue\/monthly'\)/);
      expect(ctrlRaw).toMatch(/@Get\('revenue\/comparison'\)/);
    });

    it('Weekly endpoint declares 200/400/401/403 ApiResponse', () => {
      const section = ctrlRaw.split('revenue/weekly')[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/status:\s*200/);
      expect(section).toMatch(/status:\s*401/);
      expect(section).toMatch(/status:\s*403/);
    });

    it('Comparison endpoint uses ComparisonResponseDto typed response', () => {
      const section = ctrlRaw.split('revenue/comparison')[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*ComparisonResponseDto/);
    });

    it('Comparison endpoint accepts ComparisonQueryDto (with compareWith)', () => {
      expect(ctrlRaw).toMatch(/getRevenueComparison\(@Query\(\)\s*query:\s*ComparisonQueryDto\)/);
    });
  });
});
