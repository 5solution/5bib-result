import * as fs from 'fs';
import * as path from 'path';

/**
 * F-062 Wave 2C-2 — Runner Analytics Service invariants (BR-SA-20 a-f).
 *
 * Source-scan invariant test pattern (mirrors race-performance.f062.spec.ts).
 * Covers 6 endpoints + helper composition + Wave 2A shiftMonthClamped reuse.
 */

const SVC_PATH = path.resolve(
  __dirname,
  '..',
  'services',
  'runner-analytics.service.ts',
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
    `\\n\\s{2}(?:private\\s+|public\\s+)?(?:async\\s+)?${methodName}(?:<[^>]+>)?\\(`,
  );
  const match = re.exec(src);
  if (!match) {
    throw new Error(`extractMethodBody: ${methodName} not found`);
  }
  const start = match.index;
  const rest = src.slice(start + 1);
  const nextOffset = rest.search(
    /\n\s{2}(?:private\s+|public\s+)?(?:async\s+)?\w+(?:<[^>]+>)?\(/,
  );
  const endRel = nextOffset === -1 ? rest.length : nextOffset;
  return src.slice(start, start + 1 + endRel);
}

describe('F-062 Wave 2C-2 runner-analytics service invariants', () => {
  const svcRaw = read(SVC_PATH);
  const svc = stripComments(svcRaw);
  const ctrlRaw = read(CTRL_PATH);
  const moduleRaw = read(MODULE_PATH);

  describe('Module + DI', () => {
    it('RunnerAnalyticsService registered in providers', () => {
      expect(moduleRaw).toMatch(
        /import\s*{\s*RunnerAnalyticsService\s*}\s*from\s*['"].*runner-analytics\.service['"]/,
      );
      expect(moduleRaw).toMatch(/RunnerAnalyticsService\b/);
    });
    it('Controller injects RunnerAnalyticsService', () => {
      expect(ctrlRaw).toMatch(
        /private\s+readonly\s+runnerAnalyticsService:\s*RunnerAnalyticsService/,
      );
    });
  });

  describe('SQL business invariants (BI-01 + BI-02) ALL 6 endpoints', () => {
    const methods = [
      'getBookingHeatmap',
      'getLeadTime',
      'getRepeatCohort',
      'getDemographics',
      'getGeographic',
      '_computeSummary',
    ];
    for (const m of methods) {
      it(`${m}: financial_status = paid filter mandatory`, () => {
        const body = extractMethodBody(svc, m);
        expect(body).toMatch(/financial_status\s*=\s*'paid'/);
      });
      it(`${m}: excludes MANUAL category`, () => {
        const body = extractMethodBody(svc, m);
        expect(body).toMatch(/order_category\s*!=\s*'MANUAL'/);
      });
    }
  });

  describe('Cache key convention (lesson APPLIED)', () => {
    const checks: Array<{ method: string; metric: string }> = [
      { method: 'getBookingHeatmap', metric: 'runner-heatmap' },
      { method: 'getLeadTime', metric: 'runner-leadtime' },
      { method: 'getRepeatCohort', metric: 'runner-repeat' },
      { method: 'getDemographics', metric: 'runner-demo' },
      { method: 'getGeographic', metric: 'runner-geo' },
      { method: 'getSummaryKpi', metric: 'runner-summary' },
    ];
    for (const { method, metric } of checks) {
      it(`${method} uses buildCacheKey('${metric}', query) via helper composition`, () => {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(
          new RegExp(`this\\.buildCacheKey\\(\\s*['"]${metric}['"]`),
        );
      });
      it(`${method}: NO raw analytics:${metric}: cache key string`, () => {
        const body = extractMethodBody(svc, method);
        expect(body).not.toMatch(new RegExp(`['"]analytics:${metric}:`));
      });
    }
    it('buildCacheKey delegates to shared buildMetricCacheKey + resolveScopeFromTenant + periodKeyFromInputs', () => {
      const body = extractMethodBody(svc, 'buildCacheKey');
      expect(body).toMatch(/buildMetricCacheKey\(/);
      expect(body).toMatch(/resolveScopeFromTenant\(/);
      expect(body).toMatch(/periodKeyFromInputs\(/);
    });
  });

  describe('Default period (Wave 2B-1 v2 lesson APPLIED)', () => {
    it('All 6 endpoints apply default period before validateDateRange', () => {
      for (const method of [
        'getBookingHeatmap',
        'getLeadTime',
        'getRepeatCohort',
        'getDemographics',
        'getGeographic',
        'getSummaryKpi',
      ]) {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(
          /query\s*=\s*this\.applyDefaultPeriod\(\s*query\s*\)/,
        );
        expect(body).toMatch(/this\.validateDateRange\(/);
      }
    });
    it('applyDefaultPeriod returns NEW query (spread, no mutation)', () => {
      const body = extractMethodBody(svc, 'applyDefaultPeriod');
      expect(body).toMatch(/\.\.\.query/);
      expect(body).toMatch(/if\s*\(\s*query\.from\s*\|\|\s*query\.to\s*\|\|\s*query\.month\s*\)/);
    });
  });

  describe('Lead Time bucket constants (BR-SA-20b)', () => {
    it('LEAD_TIME_BUCKETS module-level với 5 fixed buckets', () => {
      expect(svc).toMatch(/LEAD_TIME_BUCKETS[\s\S]*'0-7d'/);
      expect(svc).toMatch(/LEAD_TIME_BUCKETS[\s\S]*'8-30d'/);
      expect(svc).toMatch(/LEAD_TIME_BUCKETS[\s\S]*'31-60d'/);
      expect(svc).toMatch(/LEAD_TIME_BUCKETS[\s\S]*'61-120d'/);
      expect(svc).toMatch(/LEAD_TIME_BUCKETS[\s\S]*'120\+d'/);
      // VN labels per PRD
      expect(svc).toMatch(/'Last-minute'/);
      expect(svc).toMatch(/'Cận race'/);
      expect(svc).toMatch(/'Lập kế hoạch'/);
      expect(svc).toMatch(/'Early bird'/);
      expect(svc).toMatch(/'Super early'/);
    });
  });

  describe('Age brackets (BR-SA-20d)', () => {
    it('AGE_BRACKETS module-level with 6 fixed brackets per PRD line 502', () => {
      expect(svc).toMatch(/AGE_BRACKETS[\s\S]*'18-24'/);
      expect(svc).toMatch(/AGE_BRACKETS[\s\S]*'25-34'/);
      expect(svc).toMatch(/AGE_BRACKETS[\s\S]*'35-44'/);
      expect(svc).toMatch(/AGE_BRACKETS[\s\S]*'45-54'/);
      expect(svc).toMatch(/AGE_BRACKETS[\s\S]*'55-64'/);
      expect(svc).toMatch(/AGE_BRACKETS[\s\S]*'65\+'/);
    });
    it('getDemographics includes unknown_age bucket (KHÔNG bỏ ra per spec)', () => {
      const body = extractMethodBody(svc, 'getDemographics');
      expect(body).toMatch(/['"]unknown_age['"]/);
    });
  });

  describe('Repeat cohort 4 tiers (BR-SA-20c)', () => {
    it('getRepeatCohort buckets 1 / 2 / 3-4 / 5+ với VN labels', () => {
      const body = extractMethodBody(svc, 'getRepeatCohort');
      expect(body).toMatch(/'1':\s*0/);
      expect(body).toMatch(/'2':\s*0/);
      expect(body).toMatch(/'3-4':\s*0/);
      expect(body).toMatch(/'5\+':\s*0/);
      expect(body).toMatch(/'1 giải'/);
      expect(body).toMatch(/'5\+ giải'/);
    });
  });

  describe('Geographic top 8 + coverage (BR-SA-20e)', () => {
    it('getGeographic uses best-effort users.province + try/catch fallback', () => {
      const body = extractMethodBody(svc, 'getGeographic');
      expect(body).toMatch(/LEFT JOIN users u/);
      expect(body).toMatch(/u\.province/);
      expect(body).toMatch(/try\s*{/);
      expect(body).toMatch(/catch\s*\(/);
    });
    it('getGeographic slices top 8 only', () => {
      const body = extractMethodBody(svc, 'getGeographic');
      expect(body).toMatch(/\.slice\(0,\s*8\)/);
    });
  });

  describe('Summary KPI 4 metrics + MoM delta (BR-SA-20f)', () => {
    it('getSummaryKpi computes 4 metrics: uniqueRunners + repeatRate + avgLeadTime + avgOrdersPerRunner', () => {
      const body = extractMethodBody(svc, '_computeSummary');
      expect(body).toMatch(/uniqueRunners/);
      expect(body).toMatch(/repeatRate/);
      expect(body).toMatch(/avgLeadTime/);
      expect(body).toMatch(/avgOrdersPerRunner/);
    });
    it('getSummaryKpi uses calcDeltaPercent for delta MoM 4 metrics', () => {
      const body = extractMethodBody(svc, 'getSummaryKpi');
      const matches = body.match(/calcDeltaPercent\(/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(3); // avgLeadTime conditional
    });
    it('_shiftQueryMoM uses Wave 2A shiftMonthClamped (NOT setUTCMonth(-1))', () => {
      const body = extractMethodBody(svc, '_shiftQueryMoM');
      expect(body).toMatch(/shiftMonthClamped/);
      expect(body).not.toMatch(/setUTCMonth\(-1\)/);
    });
  });

  describe('Booking heatmap matrix (BR-SA-20a)', () => {
    it('getBookingHeatmap builds 7×24 matrix với DAYOFWEEK -1 offset (MySQL 1=Sunday → 0-indexed)', () => {
      const body = extractMethodBody(svc, 'getBookingHeatmap');
      expect(body).toMatch(/DAYOFWEEK\(om\.payment_on\)/);
      expect(body).toMatch(/HOUR\(om\.payment_on\)/);
      expect(body).toMatch(/Array\.from\(\{\s*length:\s*7\s*\}/);
      expect(body).toMatch(/Number\(r\.dow\)\s*-\s*1/);
    });
  });

  describe('Controller wiring + Swagger contract', () => {
    const endpoints = [
      'runners/booking-heatmap',
      'runners/lead-time',
      'runners/repeat-cohort',
      'runners/demographics',
      'runners/geographic',
      'runners/summary',
    ];
    it('6 NEW endpoints registered', () => {
      for (const ep of endpoints) {
        expect(ctrlRaw).toMatch(new RegExp(`@Get\\('${ep.replace(/\//g, '\\/')}'\\)`));
      }
    });
    it('Each endpoint declares 200/400/401/403', () => {
      for (const ep of endpoints) {
        const section =
          ctrlRaw.split(`@Get('${ep}')`)[1]?.split('@Get(')[0] ?? '';
        expect(section).toMatch(/status:\s*200/);
        expect(section).toMatch(/status:\s*401/);
        expect(section).toMatch(/status:\s*403/);
      }
    });
    it('Legacy /runners/behavior + /runners/booking-patterns preserved', () => {
      expect(ctrlRaw).toMatch(/@Get\('runners\/behavior'\)/);
      expect(ctrlRaw).toMatch(/@Get\('runners\/booking-patterns'\)/);
    });
  });
});
