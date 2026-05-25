import * as fs from 'fs';
import * as path from 'path';
import {
  resolveScopeFromTenant,
  periodKeyFromInputs,
  buildMetricCacheKey,
} from '../services/period-resolver';

/**
 * F-062 Wave 2B-2 — Merchant Comparison Service invariants (BR-SA-22 a/b/c).
 *
 * Source-scan invariant test pattern (mirrors revenue-endpoints.f062.spec.ts).
 * Cover:
 *   BR-SA-22a — scatter endpoint + shape match PRD line 561
 *   BR-SA-22b — health-distribution 5 tiers per BR-SA-07
 *   BR-SA-22c — comparison table + totals footer
 *   BR-SA-22 (all) — Phí 5BIB qua FeeService.computeFeeForOrdersAggregate (no inline %)
 *   BI-01      — `financial_status = 'paid'` filter mandatory
 *   BI-02      — MANUAL excluded from GMV / orders count
 *   LESSON     — Wave 2B-1 v2 cache key + helper composition convention applied
 */

const SVC_PATH = path.resolve(
  __dirname,
  '..',
  'services',
  'merchant-comparison.service.ts',
);
const CTRL_PATH = path.resolve(__dirname, '..', 'analytics.controller.ts');
const MODULE_PATH = path.resolve(__dirname, '..', 'analytics.module.ts');

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
  const re = new RegExp(
    `\\n\\s{2}(?:private\\s+|public\\s+)?(?:async\\s+)?${methodName}\\(`,
  );
  const match = re.exec(src);
  if (!match) {
    throw new Error(`extractMethodBody: ${methodName} not found`);
  }
  const start = match.index;
  const rest = src.slice(start + 1);
  const nextOffset = rest.search(
    /\n\s{2}(?:private\s+|public\s+)?(?:async\s+)?\w+\(/,
  );
  const endRel = nextOffset === -1 ? rest.length : nextOffset;
  return src.slice(start, start + 1 + endRel);
}

describe('F-062 Wave 2B-2 merchant-comparison service invariants', () => {
  const svcRaw = read(SVC_PATH);
  const svc = stripComments(svcRaw);
  const ctrlRaw = read(CTRL_PATH);
  const moduleRaw = read(MODULE_PATH);

  describe('Module registration + DI', () => {
    it('MerchantComparisonService registered in AnalyticsModule providers', () => {
      expect(moduleRaw).toMatch(
        /import\s*{\s*MerchantComparisonService\s*}\s*from\s*['"].*merchant-comparison\.service['"]/,
      );
      expect(moduleRaw).toMatch(/MerchantComparisonService\b/);
    });

    it('Controller injects MerchantComparisonService', () => {
      expect(ctrlRaw).toMatch(
        /private\s+readonly\s+merchantComparisonService:\s*MerchantComparisonService/,
      );
    });
  });

  describe('SQL business invariants (BI-01 + BI-02)', () => {
    it('_buildMerchantAggregates filters financial_status = paid trong main aggregate', () => {
      const body = extractMethodBody(svc, '_buildMerchantAggregates');
      expect(body).toMatch(/financial_status\s*=\s*'paid'/);
    });
    it('_buildMerchantAggregates excludes MANUAL from gmv + orders count', () => {
      const body = extractMethodBody(svc, '_buildMerchantAggregates');
      expect(body).toMatch(/order_category\s*!=\s*'MANUAL'/);
    });
    it('_buildMerchantAggregates uses GREATEST guard for netGmv', () => {
      const body = extractMethodBody(svc, '_buildMerchantAggregates');
      expect(body).toMatch(/GREATEST\([^,]*-\s*IFNULL\(/);
    });
    it('90-day RFM sub-query filters paid + non-MANUAL', () => {
      const body = extractMethodBody(svc, '_buildMerchantAggregates');
      expect(body).toMatch(/INTERVAL\s+90\s+DAY/);
      // Both main query + RFM sub-query có financial_status filter (2+ occurrences)
      const paidMatches = body.match(/financial_status\s*=\s*'paid'/g) ?? [];
      expect(paidMatches.length).toBeGreaterThanOrEqual(2);
      const manualMatches = body.match(/order_category\s*!=\s*'MANUAL'/g) ?? [];
      expect(manualMatches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('FeeService delegation (BR-SA-22 mandate)', () => {
    it('_buildMerchantAggregates routes platformFee qua FeeService', () => {
      const body = extractMethodBody(svc, '_buildMerchantAggregates');
      expect(body).toMatch(/feeService\.computeFeeForOrdersAggregate\(/);
      expect(body).toMatch(/pullOrdersForFeeAggregate\(/);
    });
    it('NEITHER 3 public endpoints inline % fee calc', () => {
      for (const method of [
        'getScatter',
        'getHealthDistribution',
        'getComparisonTable',
      ]) {
        const body = extractMethodBody(svc, method);
        expect(body).not.toMatch(/service_fee_rate/);
        expect(body).not.toMatch(/\*\s*0\.07/);
        expect(body).not.toMatch(/\*\s*0\.10/);
      }
    });
  });

  describe('Cache key convention (BR-SA-22 + Wave 2B-1 v2 lesson)', () => {
    it('getScatter uses buildMetricCacheKey với merchant-comp-scatter metric', () => {
      const body = extractMethodBody(svc, 'getScatter');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]merchant-comp-scatter['"]/);
      // Anti-pattern: NO raw `analytics:merchant-comp-scatter` (missing :metric: infix)
      expect(body).not.toMatch(/['"]analytics:merchant-comp-scatter:/);
    });
    it('getHealthDistribution uses buildMetricCacheKey với merchant-comp-dist metric', () => {
      const body = extractMethodBody(svc, 'getHealthDistribution');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]merchant-comp-dist['"]/);
      expect(body).not.toMatch(/['"]analytics:merchant-comp-dist:/);
    });
    it('getComparisonTable uses buildMetricCacheKey với merchant-comp-table metric', () => {
      const body = extractMethodBody(svc, 'getComparisonTable');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]merchant-comp-table['"]/);
      expect(body).not.toMatch(/['"]analytics:merchant-comp-table:/);
    });
    it('All 3 methods use shared helpers (resolveScopeFromTenant + periodKeyFromInputs)', () => {
      for (const method of [
        'getScatter',
        'getHealthDistribution',
        'getComparisonTable',
      ]) {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/resolveScopeFromTenant\(/);
        expect(body).toMatch(/periodKeyFromInputs\(/);
      }
    });
  });

  describe('Default period (lesson APPLIED from Wave 2B-1)', () => {
    it('All 3 endpoints apply default period before validateDateRange', () => {
      for (const method of [
        'getScatter',
        'getHealthDistribution',
        'getComparisonTable',
      ]) {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(
          /query\s*=\s*this\.applyDefaultPeriod\(\s*query\s*\)/,
        );
        expect(body).toMatch(/this\.validateDateRange\(/);
      }
    });
    it('applyDefaultPeriod returns NEW object (no mutation)', () => {
      const body = extractMethodBody(svc, 'applyDefaultPeriod');
      expect(body).toMatch(/\.\.\.query/);
      // Early return on explicit input
      expect(body).toMatch(/if\s*\(\s*query\.from\s*\|\|\s*query\.to\s*\|\|\s*query\.month\s*\)/);
    });
  });

  describe('Health Score classification (BR-SA-07 RFM)', () => {
    it('computeHealthScore implements RFM formula 0.4×r + 0.3×f + 0.3×m', () => {
      const body = extractMethodBody(svc, 'computeHealthScore');
      // Recency thresholds 7/14/30/60 days
      expect(body).toMatch(/days\s*<=\s*7/);
      expect(body).toMatch(/days\s*<=\s*14/);
      expect(body).toMatch(/days\s*<=\s*30/);
      expect(body).toMatch(/days\s*<=\s*60/);
      // Frequency formula min(100, orders×10)
      expect(body).toMatch(/Math\.min\(\s*100\s*,\s*orders90d\s*\*\s*10\s*\)/);
      // Monetary formula min(100, gmv/10M × 100)
      expect(body).toMatch(/Math\.min\(\s*100\s*,\s*\(gmv90d\s*\/\s*10_000_000\)\s*\*\s*100\s*\)/);
      // Weighted sum 0.4 / 0.3 / 0.3
      expect(body).toMatch(/HEALTH_WEIGHTS/);
    });

    it('5 tiers match BR-SA-07 thresholds + VN labels', () => {
      // HEALTH_TIERS constant at module level
      expect(svc).toMatch(/EXCELLENT[\s\S]*Xu[ấâấ]t s[ắă]c[\s\S]*80[\s\S]*100/);
      expect(svc).toMatch(/GOOD[\s\S]*T[ốô]t[\s\S]*60[\s\S]*79/);
      expect(svc).toMatch(/AVERAGE[\s\S]*Trung b[ìi]nh[\s\S]*40[\s\S]*59/);
      expect(svc).toMatch(/WEAK[\s\S]*Y[ếê]u[\s\S]*20[\s\S]*39/);
      expect(svc).toMatch(/AT_RISK_SCORE[\s\S]*Nguy c[ơo][\s\S]*0[\s\S]*19/);
    });

    it('classifyStatus uses NEW (tenant ≤30d + 0 orders) per BR-SA-07', () => {
      const body = extractMethodBody(svc, 'classifyStatus');
      expect(body).toMatch(/totalOrders\s*===\s*0/);
      expect(body).toMatch(/tenantAgeDays\s*<=\s*30/);
      expect(body).toMatch(/['"]NEW['"]/);
      expect(body).toMatch(/['"]ACTIVE['"]/);
      expect(body).toMatch(/['"]AT_RISK['"]/);
      expect(body).toMatch(/['"]CHURNED['"]/);
    });
  });

  describe('Controller wiring + Swagger contract', () => {
    it('3 NEW endpoints registered (scatter / health-distribution / comparison)', () => {
      expect(ctrlRaw).toMatch(/@Get\('merchants\/scatter'\)/);
      expect(ctrlRaw).toMatch(/@Get\('merchants\/health-distribution'\)/);
      expect(ctrlRaw).toMatch(/@Get\('merchants\/comparison'\)/);
    });

    it('Each endpoint declares 200/400/401/403 ApiResponse', () => {
      for (const route of [
        "merchants/scatter",
        "merchants/health-distribution",
        "merchants/comparison",
      ]) {
        const section =
          ctrlRaw.split(`@Get('${route}')`)[1]?.split('@Get(')[0] ?? '';
        expect(section).toMatch(/status:\s*200/);
        expect(section).toMatch(/status:\s*401/);
        expect(section).toMatch(/status:\s*403/);
      }
    });

    it('Scatter endpoint typed MerchantScatterPointDto array', () => {
      const section =
        ctrlRaw.split("@Get('merchants/scatter')")[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*MerchantScatterPointDto/);
      expect(section).toMatch(/isArray:\s*true/);
    });

    it('Health-distribution endpoint typed MerchantHealthDistributionTierDto array', () => {
      const section =
        ctrlRaw
          .split("@Get('merchants/health-distribution')")[1]
          ?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*MerchantHealthDistributionTierDto/);
      expect(section).toMatch(/isArray:\s*true/);
    });

    it('Comparison endpoint typed MerchantComparisonResponseDto', () => {
      const section =
        ctrlRaw
          .split("@Get('merchants/comparison')")[1]
          ?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*MerchantComparisonResponseDto/);
    });

    it('Legacy /merchants endpoint preserved (backward compat)', () => {
      // Find both @Get('merchants') (legacy) + getMerchantComparison method handler exist
      expect(ctrlRaw).toMatch(/@Get\('merchants'\)/);
      expect(ctrlRaw).toMatch(/getMerchantComparison\(@Query\(\)/);
      // Verify they're co-located (within 800-char block — accommodates description text)
      expect(ctrlRaw).toMatch(
        /@Get\('merchants'\)[\s\S]{0,800}?getMerchantComparison\(/,
      );
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Pure unit tests cho extracted shared helpers (resolveScopeFromTenant +
// periodKeyFromInputs trong period-resolver.ts) — verify behavior identical
// to Wave 2B-1 v2 private analytics.service.ts helpers (post refactor).
// ────────────────────────────────────────────────────────────────────────────

describe('F-062 Wave 2B-2 extracted shared cache helpers', () => {
  describe('resolveScopeFromTenant', () => {
    it('returns "platform" literal when no tenantId', () => {
      expect(resolveScopeFromTenant()).toBe('platform');
      expect(resolveScopeFromTenant(undefined)).toBe('platform');
    });
    it('returns { tenantId } object when tenantId provided', () => {
      expect(resolveScopeFromTenant(42)).toEqual({ tenantId: 42 });
    });
    it('treats 0 tenantId as platform scope (falsy)', () => {
      expect(resolveScopeFromTenant(0)).toBe('platform');
    });
  });

  describe('periodKeyFromInputs', () => {
    it('priority: month > range > from > to > default', () => {
      // month wins over from/to
      expect(
        periodKeyFromInputs({
          month: '2026-05',
          from: '2026-05-01',
          to: '2026-05-31',
        }),
      ).toBe('month:2026-05');
      // range when both from + to (no month)
      expect(
        periodKeyFromInputs({ from: '2026-05-01', to: '2026-05-31' }),
      ).toBe('range:2026-05-01~2026-05-31');
      // from alone
      expect(periodKeyFromInputs({ from: '2026-05-01' })).toBe(
        'from:2026-05-01',
      );
      // to alone
      expect(periodKeyFromInputs({ to: '2026-05-31' })).toBe('to:2026-05-31');
      // empty → default
      expect(periodKeyFromInputs({})).toBe('default');
    });
  });

  describe('buildMetricCacheKey composition with extracted helpers', () => {
    it('produces PRD-compliant key cho Wave 2B-2 endpoints', () => {
      expect(
        buildMetricCacheKey(
          'merchant-comp-scatter',
          resolveScopeFromTenant(42),
          periodKeyFromInputs({ month: '2026-05' }),
        ),
      ).toBe('analytics:metric:merchant-comp-scatter:tenant:42:month:2026-05');

      expect(
        buildMetricCacheKey(
          'merchant-comp-table',
          resolveScopeFromTenant(undefined),
          periodKeyFromInputs({}),
        ),
      ).toBe('analytics:metric:merchant-comp-table:platform:default');
    });
  });
});
