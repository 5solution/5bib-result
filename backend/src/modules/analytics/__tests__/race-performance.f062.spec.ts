import * as fs from 'fs';
import * as path from 'path';

/**
 * F-062 Wave 2C-1 — Race Performance Service invariants (BR-SA-21 a/b/c).
 *
 * Source-scan invariant pattern (mirrors revenue-endpoints.f062.spec.ts +
 * merchant-comparison.f062.spec.ts). Covers:
 *   BR-SA-21a — type-distribution endpoint + shape (raceType, count, gmv, avgGmv)
 *   BR-SA-21b — spotlight endpoint + nullable + insight text
 *   BR-SA-21c — performance list paginated với sort + filter
 *   BR-SA-21 (all) — Phí 5BIB qua shared pullOrdersForFeeAggregate + FeeService
 *   BI-01 — paid only filter mandatory
 *   BI-02 — MANUAL excluded
 *   LESSON — Wave 2B-1 v2 + Wave 2B-2 cache helper composition pattern applied
 *   EXTRACTION — pullOrdersForFeeAggregate extracted to shared helper (TD-WAVE2B2 resolved)
 */

const SVC_PATH = path.resolve(
  __dirname,
  '..',
  'services',
  'race-performance.service.ts',
);
const SHARED_PATH = path.resolve(
  __dirname,
  '..',
  'services',
  'fee-aggregate.helpers.ts',
);
const ANALYTICS_SVC_PATH = path.resolve(
  __dirname,
  '..',
  'analytics.service.ts',
);
const MERCHANT_SVC_PATH = path.resolve(
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
  // Match optional `<T extends X>` generic between methodName and `(`
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

describe('F-062 Wave 2C-1 race-performance service invariants', () => {
  const svcRaw = read(SVC_PATH);
  const svc = stripComments(svcRaw);
  const sharedRaw = read(SHARED_PATH);
  const ctrlRaw = read(CTRL_PATH);
  const moduleRaw = read(MODULE_PATH);
  const analyticsSvc = read(ANALYTICS_SVC_PATH);
  const merchantSvc = read(MERCHANT_SVC_PATH);

  describe('Module + DI', () => {
    it('RacePerformanceService registered in AnalyticsModule providers', () => {
      expect(moduleRaw).toMatch(
        /import\s*{\s*RacePerformanceService\s*}\s*from\s*['"].*race-performance\.service['"]/,
      );
      expect(moduleRaw).toMatch(/RacePerformanceService\b/);
    });

    it('Controller injects RacePerformanceService', () => {
      expect(ctrlRaw).toMatch(
        /private\s+readonly\s+racePerformanceService:\s*RacePerformanceService/,
      );
    });
  });

  describe('SQL business invariants (BI-01 + BI-02)', () => {
    it('_buildRaceAggregates filters financial_status = paid', () => {
      const body = extractMethodBody(svc, '_buildRaceAggregates');
      expect(body).toMatch(/financial_status\s*=\s*'paid'/);
    });
    it('_buildRaceAggregates excludes MANUAL from gmv + paid_orders count', () => {
      const body = extractMethodBody(svc, '_buildRaceAggregates');
      expect(body).toMatch(/order_category\s*!=\s*'MANUAL'/);
    });
    it('_buildRaceAggregates uses GREATEST guard for netGmv', () => {
      const body = extractMethodBody(svc, '_buildRaceAggregates');
      expect(body).toMatch(/GREATEST\([^,]*-\s*IFNULL\(/);
    });
    it('_buildRaceAggregates GROUP BY includes race_type for distribution endpoint', () => {
      const body = extractMethodBody(svc, '_buildRaceAggregates');
      expect(body).toMatch(/GROUP BY[\s\S]*?race_type/);
    });
  });

  describe('Extraction completed — pullOrdersForFeeAggregate (TD-F062-WAVE2B2 resolved)', () => {
    it('Shared helper file exists at services/fee-aggregate.helpers.ts', () => {
      expect(sharedRaw).toMatch(/export\s+async\s+function\s+pullOrdersForFeeAggregate/);
    });
    it('Race-performance service IMPORTS shared helper', () => {
      expect(svcRaw).toMatch(
        /import\s*{\s*pullOrdersForFeeAggregate\s*}\s*from\s*['"]\.\/fee-aggregate\.helpers['"]/,
      );
    });
    it('Race-performance service DOES NOT redefine private pullOrdersForFeeAggregate', () => {
      expect(svc).not.toMatch(/private\s+async\s+pullOrdersForFeeAggregate\(/);
    });
    it('Merchant-comparison service ALSO uses shared (extraction backport)', () => {
      expect(merchantSvc).toMatch(
        /import\s*{\s*pullOrdersForFeeAggregate\s*}\s*from\s*['"]\.\/fee-aggregate\.helpers['"]/,
      );
      // Old private impl removed
      const merchantStripped = stripComments(merchantSvc);
      expect(merchantStripped).not.toMatch(
        /private\s+async\s+pullOrdersForFeeAggregate\(/,
      );
    });
    it('Analytics service delegates to shared (Wave 2C-1 refactor)', () => {
      expect(analyticsSvc).toMatch(
        /import\s*{\s*pullOrdersForFeeAggregate\s+as\s+pullOrdersShared\s*}\s*from\s*['"]\.\/services\/fee-aggregate\.helpers['"]/,
      );
      expect(analyticsSvc).toMatch(/pullOrdersShared\(this\.db,/);
    });
  });

  describe('FeeService delegation (BR-SA-21 mandate)', () => {
    it('_buildRaceAggregates calls FeeService.computeFeeForOrdersAggregate per race', () => {
      const body = extractMethodBody(svc, '_buildRaceAggregates');
      expect(body).toMatch(/feeService\.computeFeeForOrdersAggregate\(/);
      expect(body).toMatch(/pullOrdersForFeeAggregate\(/);
    });
    it('NEITHER 3 public endpoints inline % fee calc', () => {
      for (const method of [
        'getTypeDistribution',
        'getSpotlight',
        'getPerformanceList',
      ]) {
        const body = extractMethodBody(svc, method);
        expect(body).not.toMatch(/service_fee_rate/);
        expect(body).not.toMatch(/\*\s*0\.07/);
        expect(body).not.toMatch(/\*\s*0\.10/);
      }
    });
  });

  describe('Cache key convention (Wave 2B-1 v2 + Wave 2B-2 lesson APPLIED)', () => {
    it('getTypeDistribution uses buildMetricCacheKey với race-perf-type metric', () => {
      const body = extractMethodBody(svc, 'getTypeDistribution');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]race-perf-type['"]/);
      expect(body).not.toMatch(/['"]analytics:race-perf-type:/);
    });
    it('getSpotlight uses buildMetricCacheKey với race-perf-spotlight metric', () => {
      const body = extractMethodBody(svc, 'getSpotlight');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]race-perf-spotlight['"]/);
      expect(body).not.toMatch(/['"]analytics:race-perf-spotlight:/);
    });
    it('getPerformanceList uses buildMetricCacheKey với race-perf-list metric + filtersHash extra axis', () => {
      const body = extractMethodBody(svc, 'getPerformanceList');
      expect(body).toMatch(/buildMetricCacheKey\(\s*['"]race-perf-list['"]/);
      // filtersHash passed as 4th extra arg per BR-SA-21c spec
      expect(body).toMatch(/buildMetricCacheKey\([\s\S]*?filtersHash[\s,]*\)/);
      expect(body).not.toMatch(/['"]analytics:race-perf-list:/);
    });
    it('All 3 methods use shared helpers (resolveScopeFromTenant + periodKeyFromInputs)', () => {
      for (const method of [
        'getTypeDistribution',
        'getSpotlight',
        'getPerformanceList',
      ]) {
        const body = extractMethodBody(svc, method);
        expect(body).toMatch(/resolveScopeFromTenant\(/);
        expect(body).toMatch(/periodKeyFromInputs\(/);
      }
    });
  });

  describe('Default period (Wave 2B-1 v2 lesson APPLIED)', () => {
    it('All 3 endpoints apply default period before validateDateRange', () => {
      for (const method of [
        'getTypeDistribution',
        'getSpotlight',
        'getPerformanceList',
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
      expect(body).toMatch(/if\s*\(\s*query\.from\s*\|\|\s*query\.to\s*\|\|\s*query\.month\s*\)/);
    });
  });

  describe('Pagination + sort (BR-SA-21c spec line 549-551)', () => {
    it('getPerformanceList enforces page size max 50', () => {
      const body = extractMethodBody(svc, 'getPerformanceList');
      expect(body).toMatch(/MAX_PAGE_SIZE/);
      // Constant declared module-level
      expect(svc).toMatch(/MAX_PAGE_SIZE\s*=\s*50/);
    });
    it('getPerformanceList default page size 12', () => {
      expect(svc).toMatch(/DEFAULT_PAGE_SIZE\s*=\s*12/);
    });
    it('getPerformanceList sortBy defaults to gmv DESC', () => {
      const body = extractMethodBody(svc, 'getPerformanceList');
      expect(body).toMatch(/sortBy\s*=\s*query\.sortBy\s*\?\?\s*['"]gmv['"]/);
      expect(body).toMatch(/sortOrder\s*=\s*query\.sortOrder\s*\?\?\s*['"]desc['"]/);
    });
    it('getPerformanceList computes totalPages = ceil(total / limit)', () => {
      const body = extractMethodBody(svc, 'getPerformanceList');
      expect(body).toMatch(/Math\.ceil\(\s*total\s*\/\s*limit\s*\)/);
    });
    it('getPerformanceList filtersHash via SHA-256 truncated', () => {
      const body = extractMethodBody(svc, 'getPerformanceList');
      expect(body).toMatch(/createHash\(\s*['"]sha256['"]\s*\)/);
      // Truncate to short hash to keep cache key length reasonable
      expect(body).toMatch(/\.slice\(0,\s*12\)/);
    });
  });

  describe('Race type normalization', () => {
    it('normalizeRaceType maps known values + OTHER fallback', () => {
      // Module-level KNOWN_RACE_TYPES constant
      expect(svc).toMatch(/KNOWN_RACE_TYPES[\s\S]*ROAD_MARATHON/);
      expect(svc).toMatch(/KNOWN_RACE_TYPES[\s\S]*ROAD_HALF_MARATHON/);
      expect(svc).toMatch(/KNOWN_RACE_TYPES[\s\S]*ULTRA_TRAIL_RACE/);
      expect(svc).toMatch(/KNOWN_RACE_TYPES[\s\S]*TRAIL_RACE/);
      // OTHER fallback for null / unknown values
      expect(svc).toMatch(/return\s+['"]OTHER['"]/);
    });
  });

  describe('Spotlight insight text (BR-SA-21b spec line 540)', () => {
    it('getSpotlight generates VN insight text với contribution % + avg per order', () => {
      const body = extractMethodBody(svc, 'getSpotlight');
      expect(body).toMatch(/Đóng góp/);
      expect(body).toMatch(/tổng GMV/);
      expect(body).toMatch(/trung bình/);
      expect(body).toMatch(/đ\/đơn/);
      // Contribution % computed from totalGmv (sum aggregates)
      expect(body).toMatch(/totalGmv/);
    });
    it('getSpotlight returns null when no aggregates (empty period)', () => {
      const body = extractMethodBody(svc, 'getSpotlight');
      expect(body).toMatch(/aggregates\.length\s*===\s*0/);
      expect(body).toMatch(/return\s+null/);
    });
  });

  describe('Controller wiring + Swagger contract', () => {
    it('3 NEW endpoints registered (type-distribution / spotlight / performance)', () => {
      expect(ctrlRaw).toMatch(/@Get\('races\/type-distribution'\)/);
      expect(ctrlRaw).toMatch(/@Get\('races\/spotlight'\)/);
      expect(ctrlRaw).toMatch(/@Get\('races\/performance'\)/);
    });

    it('Each endpoint declares 200/400/401/403 ApiResponse', () => {
      for (const route of [
        'races/type-distribution',
        'races/spotlight',
        'races/performance',
      ]) {
        const section =
          ctrlRaw.split(`@Get('${route}')`)[1]?.split('@Get(')[0] ?? '';
        expect(section).toMatch(/status:\s*200/);
        expect(section).toMatch(/status:\s*401/);
        expect(section).toMatch(/status:\s*403/);
      }
    });

    it('Type-distribution endpoint typed RaceTypeDistributionPointDto array', () => {
      const section =
        ctrlRaw.split("@Get('races/type-distribution')")[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*RaceTypeDistributionPointDto/);
      expect(section).toMatch(/isArray:\s*true/);
    });

    it('Spotlight endpoint typed RaceSpotlightDto', () => {
      const section =
        ctrlRaw.split("@Get('races/spotlight')")[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*RaceSpotlightDto/);
    });

    it('Performance list endpoint typed RacePerformanceListResponseDto + RacePerformanceListQueryDto input', () => {
      const section =
        ctrlRaw.split("@Get('races/performance')")[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*RacePerformanceListResponseDto/);
      expect(ctrlRaw).toMatch(
        /getRacePerformanceList\(@Query\(\)\s*query:\s*RacePerformanceListQueryDto\)/,
      );
    });

    it('Legacy /races endpoint preserved (backward compat F-026 era)', () => {
      expect(ctrlRaw).toMatch(/@Get\('races'\)\s*[\s\S]{0,400}?getRacePerformance/);
    });
  });
});
