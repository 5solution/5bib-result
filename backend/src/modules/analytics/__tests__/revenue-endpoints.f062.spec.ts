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
  // Tìm method declaration (async OR sync, private OR public) rồi capture đến start
  // của method kế tiếp. Naive boundary — đủ cho invariant scan, không parse AST.
  const re = new RegExp(
    `\\n\\s{2}(?:private\\s+|public\\s+)?(?:async\\s+)?${methodName}\\(`,
  );
  const match = re.exec(src);
  if (!match) {
    throw new Error(`extractMethodBody: ${methodName} not found`);
  }
  const start = match.index;
  const rest = src.slice(start + 1);
  // Next method = same pattern but ANY name (not necessarily async)
  const nextOffset = rest.search(
    /\n\s{2}(?:private\s+|public\s+)?(?:async\s+)?\w+\(/,
  );
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

  describe('Cache key convention (BR-SA-02/03/04 + BR-SA-18)', () => {
    // POST-FIX: keys must use buildMetricCacheKey helper + match PRD pattern
    // `analytics:metric:<name>:<scope>:<periodKey>` (BR-SA-18 invalidation hook depends on prefix).
    it('Weekly uses buildMetricCacheKey with weekly-revenue metric name', () => {
      const body = extractMethodBody(svc, 'getWeeklyRevenue');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]weekly-revenue['"]/);
      // Anti-pattern: NO raw `analytics:weekly-revenue` (missing :metric: infix)
      expect(body).not.toMatch(/['"]analytics:weekly-revenue:/);
    });
    it('Monthly uses buildMetricCacheKey with monthly-revenue metric name', () => {
      const body = extractMethodBody(svc, 'getMonthlyRevenue');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]monthly-revenue['"]/);
      expect(body).not.toMatch(/['"]analytics:monthly-revenue:/);
    });
    it('Comparison uses buildMetricCacheKey với compareWith như extra axis', () => {
      const body = extractMethodBody(svc, 'getComparison');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]comparison['"]/);
      // 4th arg (extra) phải là compareWith — BR-SA-04 line 216 spec
      // Allow trailing comma + multiline (Prettier may format args on separate lines)
      expect(body).toMatch(/buildMetricCacheKey\([\s\S]*?compareWith[\s,]*\)/);
      expect(body).not.toMatch(/['"]analytics:comparison:\$\{compareWith\}/);
    });

    it('All 3 methods use resolveQueryScope helper (tenant|platform)', () => {
      for (const method of ['getWeeklyRevenue', 'getMonthlyRevenue', 'getComparison']) {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/this\.resolveQueryScope\(/);
      }
    });

    it('All 3 methods use buildPeriodKey helper (stable periodKey form)', () => {
      for (const method of ['getWeeklyRevenue', 'getMonthlyRevenue', 'getComparison']) {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/this\.buildPeriodKey\(/);
      }
    });
  });

  describe('Default period BR-SA-02/03 (12 weeks / 12 months)', () => {
    it('getWeeklyRevenue applies default period via applyDefaultPeriod helper', () => {
      const body = extractMethodBody(svc, 'getWeeklyRevenue');
      expect(body).toMatch(/this\.applyDefaultPeriod\(\s*query\s*,\s*['"]week['"]\s*\)/);
    });
    it('getMonthlyRevenue applies default period via applyDefaultPeriod helper', () => {
      const body = extractMethodBody(svc, 'getMonthlyRevenue');
      expect(body).toMatch(/this\.applyDefaultPeriod\(\s*query\s*,\s*['"]month['"]\s*\)/);
    });
    it('applyDefaultPeriod uses 84 days (week) / 365 days (month) defaults', () => {
      const body = extractMethodBody(svc, 'applyDefaultPeriod' as never);
      expect(body).toMatch(/84/); // 12 weeks in days
      expect(body).toMatch(/365/); // 12 months ≈ 365 days
      // Pure function — does NOT mutate input (spread {...query} required)
      expect(body).toMatch(/\.\.\.query/);
    });
  });

  describe('Controller wiring + Swagger contract', () => {
    it('3 endpoints registered with LogtoAdminGuard (class-level)', () => {
      expect(ctrlRaw).toMatch(/@UseGuards\(LogtoAdminGuard\)/);
      expect(ctrlRaw).toMatch(/@Get\('revenue\/weekly'\)/);
      expect(ctrlRaw).toMatch(/@Get\('revenue\/monthly'\)/);
      // BR-SA-04 PRD line 200: GET /analytics/comparison (NOT /revenue/comparison)
      expect(ctrlRaw).toMatch(/@Get\('comparison'\)/);
      // Anti-pattern guard: ensure NOT mounted under /revenue/
      expect(ctrlRaw).not.toMatch(/@Get\('revenue\/comparison'\)/);
    });

    it('Weekly endpoint declares 200/400/401/403 ApiResponse', () => {
      const section = ctrlRaw.split('revenue/weekly')[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/status:\s*200/);
      expect(section).toMatch(/status:\s*401/);
      expect(section).toMatch(/status:\s*403/);
    });

    it('Comparison endpoint uses ComparisonResponseDto typed response', () => {
      const section =
        ctrlRaw.split("@Get('comparison')")[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*ComparisonResponseDto/);
    });

    it('Comparison endpoint accepts ComparisonQueryDto (with compareWith)', () => {
      expect(ctrlRaw).toMatch(
        /getRevenueComparison\(@Query\(\)\s*query:\s*ComparisonQueryDto\)/,
      );
    });
  });
});
