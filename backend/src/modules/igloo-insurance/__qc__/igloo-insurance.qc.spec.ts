/**
 * FEATURE-085 — QC adversarial tests (chạy KHÔNG cần infra: DB/Redis/HTTP).
 * Bổ sung trên 32 unit test của Coder. Live E2E (Supertest + nock) ở
 * `igloo-insurance.e2e-spec.ts` (defer live-run — precedent PROD smoke).
 */
import * as fs from 'fs';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CreateIglooRequestsDto } from '../dto/create-igloo-requests.dto';
import { IglooInsuranceController } from '../igloo-insurance.controller';
import { LogtoAdminGuard } from '../../logto-auth';
import {
  buildIglooPayload,
  computePremium,
  derivePackageCode,
  LegacyAthleteRow,
} from '../utils/igloo-helpers';
import { IglooRequestService } from '../services/igloo-request.service';
import { IglooSelectionService } from '../services/igloo-selection.service';
import { IglooInsuranceRequest } from '../schemas/igloo-insurance-request.schema';

function row(overrides: Partial<LegacyAthleteRow> = {}): LegacyAthleteRow {
  return {
    athletes_id: 101,
    name: 'Nguyễn Văn A',
    bib_number: '1234',
    email: 'a@example.com',
    dob: '1992-06-27',
    created_on: '2026-06-15',
    gender: 'MALE',
    contact_phone: '0901234567',
    id_number: '092124584349',
    race_id: 220,
    race_title: 'LÀO CAI MARATHON 2026',
    event_start_date: '2026-07-10',
    event_end_date: '2026-07-12',
    race_type: 'TRAIL_RACE',
    location: 'Nguyễn Du',
    province: 'TP. HCM',
    district: 'Thủ Đức',
    course_distance: '21KM',
    ...overrides,
  };
}

describe('QC FEATURE-085 — adversarial', () => {
  describe('SEC-1 — DTO validation (CreateIglooRequestsDto)', () => {
    function errs(obj: unknown) {
      return validateSync(plainToInstance(CreateIglooRequestsDto, obj));
    }
    it('rejects empty athleteIds (ArrayMinSize)', () => {
      expect(errs({ raceId: 220, athleteIds: [] }).length).toBeGreaterThan(0);
    });
    it('rejects > 50 athleteIds (ArrayMaxSize)', () => {
      const ids = Array.from({ length: 51 }, (_, i) => i + 1);
      expect(errs({ raceId: 220, athleteIds: ids }).length).toBeGreaterThan(0);
    });
    it('rejects missing raceId', () => {
      expect(errs({ athleteIds: [1] }).length).toBeGreaterThan(0);
    });
    it('rejects non-int athleteIds', () => {
      expect(
        errs({ raceId: 220, athleteIds: ['x'] }).length,
      ).toBeGreaterThan(0);
    });
    it('accepts a valid body', () => {
      expect(errs({ raceId: 220, athleteIds: [1, 2] }).length).toBe(0);
    });
    it('coerces string ids from legacy BIGINT (no 400) — regression PROD bug', () => {
      // TypeORM bigNumberStrings → athletes_id/race_id tới dạng string.
      // @Type(() => Number) phải coerce → KHÔNG còn "each value must be integer".
      const dto = plainToInstance(CreateIglooRequestsDto, {
        raceId: '220',
        athleteIds: ['123', '456'],
      });
      expect(validateSync(dto).length).toBe(0);
      expect(dto.raceId).toBe(220);
      expect(dto.athleteIds).toEqual([123, 456]);
    });
  });

  describe('SEC-2 — controller guarded by LogtoAdminGuard (class-level)', () => {
    it('every route inherits LogtoAdminGuard via class metadata', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        IglooInsuranceController,
      );
      expect(Array.isArray(guards)).toBe(true);
      expect(guards).toContain(LogtoAdminGuard);
    });
  });

  describe('SEC-3 — legacy SQL: no user-input interpolated into query structure', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/igloo-selection.service.ts'),
      'utf8',
    );

    it('every ${...} is a static constant or the LIKE value — KHÔNG có raceId/athleteId/limit/offset', () => {
      const uniq = Array.from(new Set(src.match(/\$\{[^}]*\}/g) ?? [])).sort();
      // Allowlist: 3 hằng số tĩnh (SELECT_COLS/BASE_FROM/extra) + `${q}` (chỉ
      // thành GIÁ TRỊ của LIKE rồi đẩy qua params — KHÔNG vào cấu trúc SQL).
      expect(uniq).toEqual(
        [
          '${IglooSelectionService.BASE_FROM}',
          '${IglooSelectionService.SELECT_COLS}',
          '${extra}',
          '${q}',
        ].sort(),
      );
    });

    it('q is bound as a LIKE param, dynamic values go through params array (?)', () => {
      expect(src).toContain('const like = `%${q}%`;');
      expect(src).toMatch(/params\.push\(like/);
      // raceId, pageSize, offset, limit truyền qua mảng tham số `?`
      expect(src).toMatch(/\[\.\.\.params, opts\.pageSize, offset\]/);
      // KHÔNG có interpolation trực tiếp các biến nguy hiểm
      expect(src).not.toMatch(/\$\{\s*raceId\s*\}/);
      expect(src).not.toMatch(/\$\{\s*athletesId\s*\}/);
      expect(src).not.toMatch(/\$\{\s*limit\s*\}/);
    });
  });

  describe('MONEY-1 — phí bất biến 10k / ROAD / 1-day mọi đường', () => {
    it('computePremium luôn 10000', () => {
      expect(computePremium().totalPayment).toBe(10000);
    });
    it.each([
      'TRAIL_RACE',
      'ULTRA_RAIL_RACE',
      'ROAD_MARATHON',
      'UNKNOWN',
      'HILLROAD_RACE',
      null,
    ])('packageCode=ROAD + premium 10k cho race_type=%s', (rt) => {
      expect(derivePackageCode(rt as string)).toBe('ROAD');
      const p = buildIglooPayload(row({ race_type: rt as string }));
      expect(p.coverage.packageCode).toBe('ROAD');
      expect(p.coverage.premium).toBe(10000);
      expect(p.coverage.from).toBe(p.coverage.to); // 1 ngày
    });
  });

  describe('IDEMP-1 — race-safe E11000 (concurrent create → 1 thắng)', () => {
    function q(result: unknown) {
      const o: Record<string, unknown> = {};
      ['select', 'sort', 'skip', 'limit', 'lean'].forEach((m) => {
        o[m] = jest.fn(() => o);
      });
      o.exec = jest.fn().mockResolvedValue(result);
      return o;
    }
    it('duplicate insert (code 11000) → skipped ALREADY_HAS_ORDER, không nhân đôi', async () => {
      const model = {
        find: jest.fn(() => q([])), // no pre-existing
        findById: jest.fn(() => q(null)),
        findByIdAndUpdate: jest.fn(() => q(null)),
        countDocuments: jest.fn(() => q(0)),
        // mô phỏng 2 request đồng thời: insert thứ 2 vướng unique index
        create: jest.fn().mockRejectedValue({ code: 11000 }),
        exists: jest.fn().mockResolvedValue(null),
      };
      const selection = { findRow: jest.fn().mockResolvedValue(row()) };

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          IglooRequestService,
          {
            provide: getModelToken(IglooInsuranceRequest.name),
            useValue: model,
          },
          { provide: IglooSelectionService, useValue: selection },
        ],
      }).compile();
      const service = moduleRef.get(IglooRequestService);

      const res = await service.createBatch(220, [101], 'admin');
      expect(res.created).toBe(0);
      expect(res.skipped).toEqual([
        { athletesId: 101, reason: 'ALREADY_HAS_ORDER' },
      ]);
    });
  });
});
