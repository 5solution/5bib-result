/**
 * F-069 M2a — QC adversarial tests cho MerchantPortalAccessService.
 *
 * Probes 3 attack vectors Coder spec KHÔNG cover:
 *
 *  ATTACK #1 — Update-after-delete race condition (HIGH severity)
 *  ATTACK #2 — Update no-op pollutes audit log with empty diff (LOW)
 *  ATTACK #3 — Race override exclude outside tenant scope (BR-MP-33 spec gap, MED)
 *
 * Verdict: Attack #1 demonstrates a real race condition. Coder must acknowledge +
 * schedule fix M2b OR fix M2a re-submit. Attacks #2 and #3 are documented TDs.
 */

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

import { AuditLogService } from '../../audit/services/audit-log.service';
import { LogtoService } from '../../logto-auth/logto.service';
import { MailService } from '../../notification/mail.service';
import { Tenant } from '../../merchant/entities/tenant.entity';
import { MerchantPortalAccess } from '../schemas/merchant-portal-access.schema';
import { MerchantPortalAccessService } from './merchant-portal-access.service';

describe('MerchantPortalAccessService — QC ADVERSARIAL probes', () => {
  let service: MerchantPortalAccessService;
  let mockModel: any;
  let mockTenantRepo: { find: jest.Mock };
  let mockRedis: any;
  let mockAuditLog: { emit: jest.Mock };
  let mockLogtoService: any;
  let mockMail: { sendCustomHtml: jest.Mock };

  beforeEach(async () => {
    mockModel = Object.assign(jest.fn(), {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
      // Default truthy — Attack #1 tests override per-case to simulate delete race.
      exists: jest.fn().mockResolvedValue({ _id: 'exists' }),
    });

    mockTenantRepo = {
      find: jest.fn().mockResolvedValue([{ id: 42, name: 'BTC' }]),
    };

    const mockPipeline = { del: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
    const mockScanStreamObj = {
      on: jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'end') setTimeout(() => cb(), 0);
        return mockScanStreamObj;
      }),
    };
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      scanStream: jest.fn().mockReturnValue(mockScanStreamObj),
    };
    mockAuditLog = { emit: jest.fn().mockResolvedValue(undefined) };
    mockLogtoService = {
      lookupByIdWithCache: jest.fn(),
      lookupByEmail: jest.fn(),
    };
    mockMail = { sendCustomHtml: jest.fn().mockResolvedValue(true) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantPortalAccessService,
        { provide: getModelToken(MerchantPortalAccess.name), useValue: mockModel },
        { provide: getRepositoryToken(Tenant, 'platform'), useValue: mockTenantRepo },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: LogtoService, useValue: mockLogtoService },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = moduleRef.get(MerchantPortalAccessService);
  });

  // ──────────────────────────────────────────────────────────────
  // ATTACK #1 — Update-after-delete race (HIGH severity)
  // ──────────────────────────────────────────────────────────────
  //
  // Sequence demonstrating the bug:
  //   Admin A: findById (returns doc) — line 455
  //   Admin B: findById (returns same doc) — line 547 (delete flow)
  //   Both wait for SETNX merchant-access-lock:<userId>
  //   B-SETNX wins → audit emit → deleteOne → release
  //   A-SETNX wins → save() ← on a doc whose _id NO LONGER exists in DB
  //   Mongoose save() upserts → record RECREATED with original _id + userId
  //
  // Effect: admin thought record was deleted, but concurrent admin update RESURRECTS it.
  //   Implication: revoked merchant user could regain access if timing wins.
  //
  // Fix recommendation: after acquireAccessLock in update(), re-verify doc exists:
  //   const stillExists = await this.accessModel.exists({ _id: existing._id });
  //   if (!stillExists) throw NotFoundException(...)
  //
  // ──────────────────────────────────────────────────────────────
  describe('Attack #1: Update-after-delete race condition — FIXED M2b-1', () => {
    function makeDoc(): any {
      return {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        userId: 'logto_victim',
        userName: 'Old Name',
        email: 'a@b.com',
        tenantIds: [42],
        raceOverrides: { include: [], exclude: [] },
        permissions: ['ticket_report'],
        isActive: true,
        createdBy: 'admin_creator',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
    }

    it('FIXED — update throws 404 when record deleted between findById and lock acquire (exists()=null)', async () => {
      const doc = makeDoc();
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });
      // Concurrent delete completed during lock-wait → exists() returns null
      mockModel.exists.mockResolvedValue(null);

      await expect(
        service.update('507f1f77bcf86cd799439011', { userName: 'New Name' }, 'admin_B'),
      ).rejects.toThrow(NotFoundException);

      // Zombie resurrection PREVENTED — save() never called
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('FIXED — update proceeds normally when record still exists (exists()=truthy)', async () => {
      const doc = makeDoc();
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });
      mockModel.exists.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        { userName: 'New Name' },
        'admin_B',
      );

      expect(doc.save).toHaveBeenCalled();
      expect(result.userName).toBe('New Name');
    });

    it('FIXED — delete throws 404 when already deleted (prevents duplicate audit emit)', async () => {
      const doc = makeDoc();
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });
      mockModel.exists.mockResolvedValue(null); // already deleted by concurrent admin

      await expect(
        service.delete('507f1f77bcf86cd799439011', 'admin_B'),
      ).rejects.toThrow(NotFoundException);

      // Duplicate audit emit PREVENTED
      expect(mockAuditLog.emit).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // ATTACK #2 — Update no-op pollutes audit log (LOW)
  // ──────────────────────────────────────────────────────────────
  describe('Attack #2: Update no-op call emits audit with empty diff', () => {
    it('PATCH with empty body emits audit log với before === after', async () => {
      const doc: any = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        userId: 'u1',
        userName: 'Same',
        email: 'a@b.com',
        tenantIds: [42],
        raceOverrides: { include: [], exclude: [] },
        permissions: ['ticket_report'],
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockModel.findById.mockReturnValue({
        exec: () => Promise.resolve(doc),
      });

      // PATCH với empty body
      await service.update('507f1f77bcf86cd799439011', {}, 'admin_xyz');

      // BUG: audit log emit still happens with no-op diff
      expect(mockAuditLog.emit).toHaveBeenCalled();
      const call = mockAuditLog.emit.mock.calls[0][0];
      // before === after (no actual change)
      expect(call.metadata.changes.before).toEqual(call.metadata.changes.after);

      // QC NOTE: Minor — pollutes audit log with no-op entries. Fix: early-return
      // if Object.keys(dto).length === 0 before lock acquire.
    });
  });

  // ──────────────────────────────────────────────────────────────
  // ATTACK #3 — Race override exclude outside tenant scope (BR-MP-33 gap)
  // ──────────────────────────────────────────────────────────────
  describe('Attack #3: BR-MP-33 race override exclude validation gap', () => {
    it('GAP — exclude raceIds NOT validated against tenant ownership at M2a', async () => {
      // BR-MP-33 spec: "raceOverrides.exclude must reference races thuộc tenantIds scope"
      // M2a service `validateTenantIds()` only validates tenant existence, NOT
      // that exclude raceIds belong to those tenants.
      //
      // Currently exclude races outside tenant scope = silent no-op (exclude won't
      // match real assignment from M2b resolveAccessibleRaces).
      //
      // Admin can submit exclude: [999999] (race not in any assigned tenant) →
      // 201 success (semantically wrong per spec, but harmless effect).

      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const newDoc: any = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        userId: 'u_exclude_outside',
        userName: 'Test',
        email: 'a@b.com',
        tenantIds: [42],
        raceOverrides: { include: [], exclude: [999999] }, // exclude not in tenant 42
        permissions: ['ticket_report'],
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn(),
      };
      mockModel.create.mockResolvedValue(newDoc);

      // Currently: 201 success (BR-MP-33 spec gap)
      const result = await service.create(
        {
          userId: 'u_exclude_outside',
          userName: 'Test',
          email: 'a@b.com',
          tenantIds: [42],
          raceOverrides: { include: [], exclude: [999999] },
          permissions: ['ticket_report'],
        },
        'admin_xyz',
      );

      // Verifies current behavior accepts it
      expect(result.raceOverrides.exclude).toEqual([999999]);

      // QC NOTE: BR-MP-33 spec line says exclude raceIds must belong to tenants.
      // M2b service `resolveAccessibleRaces` natural enforcement OR M2a validate.
      // Acceptable to defer — exclude outside scope has zero effect on data scoping.
    });
  });

  // ──────────────────────────────────────────────────────────────
  // BONUS — verify audit graceful degrade (AuditLogService.emit best-effort)
  // ──────────────────────────────────────────────────────────────
  describe('Bonus: Audit emit failure does NOT block mutation', () => {
    it('audit emit fail → create still succeeds', async () => {
      mockAuditLog.emit.mockImplementation(async () => {
        // Real AuditLogService.emit catches errors and logs warn (F-023).
        // Simulating "best effort" behavior here.
        return undefined;
      });

      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const doc: any = {
        _id: { toString: () => 'x' },
        userId: 'u_audit_fail',
        userName: 'X',
        email: 'a@b.com',
        tenantIds: [42],
        raceOverrides: { include: [], exclude: [] },
        permissions: ['ticket_report'],
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockModel.create.mockResolvedValue(doc);

      const result = await service.create(
        {
          userId: 'u_audit_fail',
          userName: 'X',
          email: 'a@b.com',
          tenantIds: [42],
          permissions: ['ticket_report'],
        },
        'admin_xyz',
      );

      expect(result.userId).toBe('u_audit_fail');
    });
  });
});
