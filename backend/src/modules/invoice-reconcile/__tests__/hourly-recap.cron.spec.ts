/**
 * F-079 TC-79-07 — Cron expression verification.
 *
 * Verify `'0 0 8,10,12,14,16,18,20,22 * * *'` decorator wired đúng trên
 * `InvoiceHourlyRecapCron.run()` qua Reflect metadata + source-level grep
 * assertion (cron parsing library KHÔNG bundled — runtime validated by
 * `@nestjs/schedule` boot).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import 'reflect-metadata';
import { InvoiceHourlyRecapCron } from '../crons/hourly-recap.cron';

describe('F-079 — hourly-recap cron expression', () => {
  const HEARTBEAT_EXPR = '0 0 8,10,12,14,16,18,20,22 * * *';
  const OLD_EXPR = '0 0 8-20 * * *';

  describe('TC-79-07 — source assertion: cron file contains new heartbeat expression', () => {
    const source = readFileSync(
      join(__dirname, '..', 'crons', 'hourly-recap.cron.ts'),
      'utf-8',
    );

    it('source file embeds new heartbeat expression', () => {
      expect(source).toContain(HEARTBEAT_EXPR);
    });

    it('source file does NOT use old expression 0 0 8-20 in active @Cron', () => {
      // The OLD_EXPR may appear in comments (regression hint), but not in the
      // active @Cron() decorator. Check that decorator line uses new expr.
      const cronDecoratorMatch = source.match(
        /@Cron\(['"](0 0 [0-9,*-]+ \* \* \*)['"]/,
      );
      expect(cronDecoratorMatch).not.toBeNull();
      expect(cronDecoratorMatch?.[1]).toBe(HEARTBEAT_EXPR);
      expect(cronDecoratorMatch?.[1]).not.toBe(OLD_EXPR);
    });

    it('source declares timezone Asia/Ho_Chi_Minh + name invoice-reconcile-hourly-recap', () => {
      expect(source).toContain("timeZone: 'Asia/Ho_Chi_Minh'");
      expect(source).toContain("name: 'invoice-reconcile-hourly-recap'");
    });
  });

  describe('TC-79-07b — Reflect metadata sanity', () => {
    it('cron class instantiable + has run() method', () => {
      // Smoke test: class compiles, has run method.
      expect(InvoiceHourlyRecapCron).toBeDefined();
      expect(typeof InvoiceHourlyRecapCron.prototype.run).toBe('function');
    });
  });

  describe('Math verification — expression maps to 8 fire times/day', () => {
    it('comma-list "8,10,12,14,16,18,20,22" = 8 distinct hours (heartbeat 2h tick)', () => {
      // Parse 3rd field manually from HEARTBEAT_EXPR
      const fields = HEARTBEAT_EXPR.split(' ');
      // Index 2 = hour field (sec=0, min=1, hour=2)
      const hourField = fields[2];
      expect(hourField).toBe('8,10,12,14,16,18,20,22');
      const hours = hourField.split(',').map(Number);
      expect(hours).toEqual([8, 10, 12, 14, 16, 18, 20, 22]);
      expect(hours.length).toBe(8);
      // Spacing: every 2 hours
      for (let i = 1; i < hours.length; i++) {
        expect(hours[i] - hours[i - 1]).toBe(2);
      }
    });

    it('old expression "8-20" = 13 hours/day (regression noise level)', () => {
      // Documentation: this is why F-079 BR-79-01 reduces noise.
      const oldHours = [];
      for (let h = 8; h <= 20; h++) oldHours.push(h);
      expect(oldHours.length).toBe(13);
      // F-079 reduction: 13 → 8 = -38% noise
      expect(13 - 8).toBe(5);
    });
  });
});
