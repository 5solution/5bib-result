import * as fs from 'fs';
import * as path from 'path';

/**
 * F-062 Wave 2C-3 — GA4 + Export services invariants (BR-SA-10 + BR-SA-11).
 * Source-scan pattern. Verifies graceful fallback + CSV BOM + max rows guard +
 * cache key convention.
 */

const GA4_PATH = path.resolve(__dirname, '..', 'services', 'ga4.service.ts');
const EXP_PATH = path.resolve(__dirname, '..', 'services', 'export.service.ts');
const CTRL_PATH = path.resolve(__dirname, '..', 'analytics.controller.ts');
const MODULE_PATH = path.resolve(__dirname, '..', 'analytics.module.ts');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

describe('F-062 Wave 2C-3 GA4 + Export invariants', () => {
  const ga4 = read(GA4_PATH);
  const exp = read(EXP_PATH);
  const ctrl = read(CTRL_PATH);
  const mod = read(MODULE_PATH);

  describe('Module + DI', () => {
    it('Ga4Service + ExportService registered', () => {
      expect(mod).toMatch(/Ga4Service\b/);
      expect(mod).toMatch(/ExportService\b/);
    });
    it('Controller injects both services', () => {
      expect(ctrl).toMatch(/private\s+readonly\s+ga4Service:\s*Ga4Service/);
      expect(ctrl).toMatch(/private\s+readonly\s+exportService:\s*ExportService/);
    });
  });

  describe('GA4 graceful fallback (BR-SA-11)', () => {
    it('Returns {available: false} if GA4_SERVICE_ACCOUNT_KEY_PATH not set', () => {
      expect(ga4).toMatch(/process\.env\.GA4_SERVICE_ACCOUNT_KEY_PATH/);
      expect(ga4).toMatch(/available:\s*false/);
      expect(ga4).toMatch(/GA4 chưa được cấu hình/);
    });
    it('NEVER throws on GA4 API failure (catch + return available:false)', () => {
      expect(ga4).toMatch(/catch\s*\(\s*e[\s\S]*?available:\s*false[\s\S]*?GA4 API error/);
    });
    it('Cache key analytics:metric:ga4-overview:* via buildMetricCacheKey', () => {
      expect(ga4).toMatch(/buildMetricCacheKey\(\s*['"]ga4-overview['"]/);
      expect(ga4).not.toMatch(/['"]analytics:ga4-overview:/);
    });
    it('GA4 TTL 600s per PRD spec (NOT 900/86400)', () => {
      expect(ga4).toMatch(/TTL_GA4\s*=\s*600/);
    });
    it('Lazy import @google-analytics/data to avoid cold-start cost', () => {
      expect(ga4).toMatch(/await import\(\s*['"]@google-analytics\/data['"]/);
    });
  });

  describe('Export service (BR-SA-10 fix TD-F026-EXPORT-STUB)', () => {
    it('CSV uses UTF-8 BOM cho Excel VN', () => {
      // BOM character U+FEFF
      expect(exp).toMatch(/CSV_BOM\s*=\s*['"]﻿['"]/);
      expect(exp).toMatch(/Buffer\.from\(\s*CSV_BOM/);
    });
    it('Max 10K rows enforced', () => {
      expect(exp).toMatch(/MAX_EXPORT_ROWS\s*=\s*10_000/);
      expect(exp).toMatch(/Dữ liệu quá lớn/);
      expect(exp).toMatch(/BadRequestException/);
    });
    it('Filename format 5bib-analytics-{reportType}-{YYYYMMDD}.{format}', () => {
      expect(exp).toMatch(/5bib-analytics-\$\{reportType\}-\$\{ymd\}\.\$\{format\}/);
    });
    it('Excel uses exceljs với format VND/percent', () => {
      expect(exp).toMatch(/import \* as ExcelJS from ['"]exceljs['"]/);
      expect(exp).toMatch(/'#,##0\s*"₫"'/);
      expect(exp).toMatch(/'0\.00"%"'/);
    });
    it('Supports 6 reportType variants', () => {
      const types = ['overview', 'revenue', 'races', 'merchants', 'funnel', 'runners'];
      for (const t of types) {
        expect(exp).toMatch(new RegExp(`case ['"]${t}['"]:`));
      }
    });
    it('MIME types correct (text/csv + xlsx OOXML)', () => {
      expect(exp).toMatch(/text\/csv;\s*charset=utf-8/);
      expect(exp).toMatch(/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
    });
    it('NO cache (always fresh per BR-SA-10)', () => {
      // No cachedQuery wrapper in generate()
      expect(exp).not.toMatch(/cachedQuery\(/);
      expect(exp).not.toMatch(/redis\.get\(/);
    });
  });

  describe('Controller wiring + Swagger', () => {
    it('GET /analytics/ga4/overview + /analytics/export registered', () => {
      expect(ctrl).toMatch(/@Get\('ga4\/overview'\)/);
      expect(ctrl).toMatch(/@Get\('export'\)/);
    });
    it('Export endpoint uses @Res streaming + Content-Disposition', () => {
      expect(ctrl).toMatch(/exportAnalytics\([\s\S]*?@Res\(\)\s*res:\s*Response/);
      expect(ctrl).toMatch(/Content-Disposition/);
      expect(ctrl).toMatch(/attachment;\s*filename=/);
    });
    it('GA4 endpoint typed Ga4OverviewResponseDto', () => {
      const section =
        ctrl.split("@Get('ga4/overview')")[1]?.split('@Get(')[0] ?? '';
      expect(section).toMatch(/type:\s*Ga4OverviewResponseDto/);
    });
    it('Export accepts ExportAnalyticsQueryDto with @IsIn validators', () => {
      expect(ctrl).toMatch(/exportAnalytics\(\s*@Query\(\)\s*query:\s*ExportAnalyticsQueryDto/);
    });
  });
});
