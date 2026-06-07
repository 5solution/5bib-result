/**
 * F-069 M2a — MerchantPortalAccessService unit tests.
 *
 * Coverage targets (per PRD TC-MP-11..14, 23, 24 + R2 TC-MP-30 + adversarial):
 *  - create happy path → 201 + audit emit + cache invalidate
 *  - create duplicate userId → 409 `409_DUPLICATE`
 *  - create invalid tenantId → 400 `400_INVALID_TENANT`
 *  - create empty scope → 400 `400_SCOPE_EMPTY`
 *  - create revenue_report without ticket_report → 400 `400_PERMISSION_INVALID`
 *  - create cross-tenant → audit metadata isCrossTenant: true
 *  - create concurrent (SETNX) → 1 win + 1 conflict 409
 *  - update partial → audit before/after diff
 *  - update toggle isActive only → action 'merchant_access.toggle'
 *  - delete hard → audit BEFORE remove + cache flush
 *  - lookupLogto email format vs userId format
 *  - lookupLogto null result → found: false
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

import { AuditLogService } from '../../audit/services/audit-log.service';
import { LogtoService } from '../../logto-auth/logto.service';
import { MailService } from '../../notification/mail.service';
import { Tenant } from '../../merchant/entities/tenant.entity';
import { MerchantPortalAccess } from '../schemas/merchant-portal-access.schema';
import { MerchantPortalAccessService } from './merchant-portal-access.service';

type AccessDocStub = {
  _id: { toString: () => string };
  userId: string;
  userName: string;
  email: string;
  tenantIds: number[];
  raceOverrides: { include: number[]; exclude: number[] };
  permissions: string[];
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  save: jest.Mock;
};

function makeDoc(overrides: Partial<AccessDocStub> = {}): AccessDocStub {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    userId: 'logto_user_abc',
    userName: 'Nguyễn Văn A',
    email: 'a@btc.vn',
    tenantIds: [42],
    raceOverrides: { include: [], exclude: [] },
    permissions: ['ticket_report'],
    isActive: true,
    createdBy: 'admin_xyz',
    createdAt: new Date('2026-06-05T00:00:00Z'),
    updatedAt: new Date('2026-06-05T00:00:00Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MerchantPortalAccessService', () => {
  let service: MerchantPortalAccessService;
  let mockModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    create: jest.Mock;
    deleteOne: jest.Mock;
  };
  let mockTenantRepo: { find: jest.Mock };
  let mockRedis: {
    set: jest.Mock;
    del: jest.Mock;
    get: jest.Mock;
    pipeline: jest.Mock;
    scanStream: jest.Mock;
  };
  let mockAuditLog: { emit: jest.Mock };
  let mockLogtoService: {
    lookupByIdWithCache: jest.Mock;
    lookupByEmail: jest.Mock;
    createUser: jest.Mock;
    resolveRoleIdsByNames: jest.Mock;
    assignUserRoles: jest.Mock;
  };
  let mockMail: { sendCustomHtml: jest.Mock };

  beforeEach(async () => {
    // Mongoose model — supports both constructor pattern AND static methods.
    // jest.fn() makes mockModel callable.
    mockModel = Object.assign(jest.fn(), {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
      // F-069 M2b-1: exists() re-verify after SETNX lock (race-condition fix).
      // Default truthy so update/delete happy-path tests proceed.
      exists: jest.fn().mockResolvedValue({ _id: 'exists' }),
    }) as unknown as typeof mockModel;

    mockTenantRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 42, name: 'BTC Marathon Đà Lạt' },
        { id: 99, name: 'BTC Trail Sapa' },
      ]),
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
      createUser: jest.fn(),
      resolveRoleIdsByNames: jest.fn(),
      assignUserRoles: jest.fn(),
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

  // ────────────────────────────────────────────────────────────────
  // create — TC-MP-11 happy path
  // ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validDto = {
      userId: 'logto_new_user',
      userName: 'Trần Thị B',
      email: 'b@btc.vn',
      tenantIds: [42],
      permissions: ['ticket_report' as const],
    };

    it('happy path → 201 + audit emit + cache invalidate (TC-MP-11)', async () => {
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const newDoc = makeDoc({ userId: validDto.userId });
      mockModel.create.mockResolvedValue(newDoc);

      const result = await service.create(validDto, 'admin_xyz');

      expect(result.userId).toBe(validDto.userId);
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: validDto.userId,
          createdBy: 'admin_xyz',
        }),
      );
      // Audit emit with proper action + actor + entity shape
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'merchant_access.create',
          actor: { userId: 'admin_xyz', role: 'admin' },
          entity: expect.objectContaining({ type: 'merchant_portal_access' }),
          metadata: expect.objectContaining({
            targetUserId: validDto.userId,
            isCrossTenant: false,
          }),
        }),
      );
      // SETNX lock acquired + released
      expect(mockRedis.set).toHaveBeenCalledWith(
        'merchant-access-lock:logto_new_user',
        '1',
        'EX',
        10,
        'NX',
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'merchant-access-lock:logto_new_user',
      );
    });

    it('TC-MP-12 — duplicate userId → 409 `409_DUPLICATE`', async () => {
      mockModel.findOne.mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve({ userId: validDto.userId }),
        }),
      });

      await expect(service.create(validDto, 'admin_xyz')).rejects.toThrow(
        ConflictException,
      );

      // Verify NO mutation occurred
      expect(mockModel.create).not.toHaveBeenCalled();
      expect(mockAuditLog.emit).not.toHaveBeenCalled();
    });

    it('TC-MP-13 — invalid tenantId → 400 `400_INVALID_TENANT`', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 42, name: 'BTC' }]);
      // dto requests tenant 99999 which doesn't exist
      await expect(
        service.create(
          { ...validDto, tenantIds: [42, 99999] },
          'admin_xyz',
        ),
      ).rejects.toThrow(BadRequestException);

      // MUST NOT leak MySQL table structure
      try {
        await service.create({ ...validDto, tenantIds: [99999] }, 'admin_xyz');
      } catch (e) {
        expect((e as Error).message).not.toMatch(/SELECT|FROM|TypeORM/i);
      }
    });

    it('empty scope (no tenantIds, no include) → 400 `400_SCOPE_EMPTY`', async () => {
      await expect(
        service.create(
          { ...validDto, tenantIds: [], raceOverrides: { include: [], exclude: [] } },
          'admin_xyz',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('revenue_report without ticket_report → 400 `400_PERMISSION_INVALID`', async () => {
      await expect(
        service.create(
          { ...validDto, permissions: ['revenue_report' as const] },
          'admin_xyz',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('TC-MP-14 — cross-tenant → audit metadata isCrossTenant: true', async () => {
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const crossDoc = makeDoc({ tenantIds: [42, 99] });
      mockModel.create.mockResolvedValue(crossDoc);

      await service.create(
        {
          ...validDto,
          tenantIds: [42, 99],
          permissions: ['ticket_report', 'revenue_report'],
        },
        'admin_xyz',
      );

      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            isCrossTenant: true,
            tenantIds: [42, 99],
            permissions: ['ticket_report', 'revenue_report'],
          }),
        }),
      );
    });

    it('TC-MP-30 — concurrent SETNX → 1 win 201, 1 lose 409 `409_CONCURRENT_EDIT`', async () => {
      // First call acquires lock OK, second call gets null
      let lockState = false;
      mockRedis.set.mockImplementation(async () => {
        if (lockState) return null; // 2nd caller blocked
        lockState = true;
        return 'OK';
      });
      mockRedis.del.mockImplementation(async () => {
        lockState = false;
        return 1;
      });

      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const doc = makeDoc({ userId: validDto.userId });
      mockModel.create.mockImplementation(async () => {
        // Hold inside lock window — simulates slow Mongo write
        await new Promise((r) => setTimeout(r, 5));
        return doc;
      });

      const [r1, r2] = await Promise.allSettled([
        service.create(validDto, 'admin_A'),
        service.create(validDto, 'admin_B'),
      ]);

      const winners = [r1, r2].filter((r) => r.status === 'fulfilled');
      const losers = [r1, r2].filter((r) => r.status === 'rejected');
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      // Loser must be ConflictException 409_CONCURRENT_EDIT
      const loserRejection = losers[0] as PromiseRejectedResult;
      expect(loserRejection.reason).toBeInstanceOf(ConflictException);
      const response = (loserRejection.reason as ConflictException).getResponse() as {
        errorCode?: string;
      };
      expect(response.errorCode).toBe('409_CONCURRENT_EDIT');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // update — TC-MP-23
  // ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('TC-MP-23 — happy path partial update → audit before/after diff', async () => {
      const existing = makeDoc();
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(existing) });

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        { permissions: ['ticket_report', 'revenue_report'] },
        'admin_xyz',
      );

      expect(result.permissions).toEqual(['ticket_report', 'revenue_report']);
      expect(existing.save).toHaveBeenCalled();
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'merchant_access.update',
          metadata: expect.objectContaining({
            changes: expect.objectContaining({
              before: expect.objectContaining({ permissions: ['ticket_report'] }),
              after: expect.objectContaining({
                permissions: ['ticket_report', 'revenue_report'],
              }),
            }),
          }),
        }),
      );
    });

    it('toggle isActive only → action `merchant_access.toggle`', async () => {
      const existing = makeDoc({ isActive: true });
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(existing) });

      await service.update(
        '507f1f77bcf86cd799439011',
        { isActive: false },
        'admin_xyz',
      );

      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'merchant_access.toggle' }),
      );
    });

    it('not found → 404', async () => {
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
      await expect(
        service.update('507f1f77bcf86cd799439011', { isActive: false }, 'admin_xyz'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // delete — TC-MP-24 hard delete + audit before remove
  // ────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('TC-MP-24 — hard delete + audit emit BEFORE remove with full snapshot', async () => {
      const existing = makeDoc();
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(existing) });
      mockModel.deleteOne.mockReturnValue({ exec: () => Promise.resolve({}) });

      // Track call order: audit emit MUST happen BEFORE deleteOne
      const callOrder: string[] = [];
      mockAuditLog.emit.mockImplementation(async () => {
        callOrder.push('audit');
      });
      mockModel.deleteOne.mockImplementation(() => ({
        exec: async () => {
          callOrder.push('delete');
          return {};
        },
      }));

      const result = await service.delete(
        '507f1f77bcf86cd799439011',
        'admin_xyz',
      );

      expect(result).toEqual({
        success: true,
        deletedUserId: existing.userId,
      });
      // Order: audit BEFORE delete
      expect(callOrder).toEqual(['audit', 'delete']);
      // Snapshot in audit metadata
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'merchant_access.delete',
          metadata: expect.objectContaining({
            snapshot: expect.objectContaining({
              tenantIds: existing.tenantIds,
              permissions: existing.permissions,
            }),
          }),
        }),
      );
    });

    it('not found → 404 (no audit emit, no delete)', async () => {
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });

      await expect(
        service.delete('507f1f77bcf86cd799439011', 'admin_xyz'),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLog.emit).not.toHaveBeenCalled();
      expect(mockModel.deleteOne).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // lookupLogto — BR-MP-36 REUSE M1 LogtoService
  // ────────────────────────────────────────────────────────────────

  describe('lookupLogto()', () => {
    it('q contains @ → email lookup', async () => {
      mockLogtoService.lookupByEmail.mockResolvedValue({
        userId: 'logto_abc',
        email: 'admin@btc.vn',
        name: 'Admin',
        username: 'admin',
      });

      const result = await service.lookupLogto('admin@btc.vn');

      expect(mockLogtoService.lookupByEmail).toHaveBeenCalledWith('admin@btc.vn');
      expect(mockLogtoService.lookupByIdWithCache).not.toHaveBeenCalled();
      expect(result.found).toBe(true);
      expect(result.user?.email).toBe('admin@btc.vn');
    });

    it('q without @ → userId lookup', async () => {
      mockLogtoService.lookupByIdWithCache.mockResolvedValue({
        userId: 'logto_abc',
        email: 'a@b.com',
        name: 'A',
        username: 'a',
      });

      const result = await service.lookupLogto('logto_abc');

      expect(mockLogtoService.lookupByIdWithCache).toHaveBeenCalledWith('logto_abc');
      expect(mockLogtoService.lookupByEmail).not.toHaveBeenCalled();
      expect(result.found).toBe(true);
    });

    it('null result → found: false (graceful degrade)', async () => {
      mockLogtoService.lookupByIdWithCache.mockResolvedValue(null);

      const result = await service.lookupLogto('logto_missing');

      expect(result.found).toBe(false);
      expect(result.user).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // findAll — list view
  // ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated list với tenant names enriched + computed raceCount', async () => {
      const docs = [
        makeDoc({ userId: 'u1', tenantIds: [42], raceOverrides: { include: [], exclude: [] } }),
        makeDoc({ userId: 'u2', tenantIds: [42, 99], raceOverrides: { include: [], exclude: [] } }),
      ];
      mockModel.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ exec: () => Promise.resolve(docs) }),
          }),
        }),
      });
      mockModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(2) });

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      // Tenant 42 enriched with name from mockTenantRepo
      expect(result.items[0].tenantNames).toContain('BTC Marathon Đà Lạt');
      // raceCount sentinel for tenant-only scope (no exclude)
      expect(result.items[0].raceCount).toBe('__all');
    });

    it('search by q → applies regex to userName + email', async () => {
      mockModel.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ exec: () => Promise.resolve([]) }),
          }),
        }),
      });
      mockModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(0) });

      await service.findAll({ q: 'Nguyễn' });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({ userName: expect.any(RegExp) }),
          ]),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // findOne
  // ────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns ResponseDto with id alias (strip _id raw per BR-MP-23)', async () => {
      const doc = makeDoc();
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toHaveProperty('id', '507f1f77bcf86cd799439011');
      // Verify response shape doesn't expose raw Mongoose _id field
      expect(result).not.toHaveProperty('_id');
      expect(result).not.toHaveProperty('__v');
    });

    it('not found → 404', async () => {
      mockModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // M3b — auto-provision (create by email when no userId)
  // ───────────────────────────────────────────────────────────────────
  describe('M3b auto-provision', () => {
    const emailDto = {
      userName: 'Nguyễn BTC',
      email: 'new@btc.vn',
      tenantIds: [42],
      permissions: ['ticket_report' as const],
    };

    const noDup = () =>
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });

    it('email chưa có Logto → createUser + assign merchant_viewer + invite email + provisioned:true', async () => {
      noDup();
      mockLogtoService.lookupByEmail.mockResolvedValue(null);
      mockLogtoService.createUser.mockResolvedValue('logto_provisioned_1');
      mockLogtoService.resolveRoleIdsByNames.mockResolvedValue(['role_viewer']);
      mockModel.create.mockResolvedValue(makeDoc({ userId: 'logto_provisioned_1' }));

      const result = await service.create(emailDto, 'admin_xyz');

      expect(mockLogtoService.createUser).toHaveBeenCalledWith(
        'new@btc.vn',
        'Nguyễn BTC',
      );
      expect(mockLogtoService.resolveRoleIdsByNames).toHaveBeenCalledWith([
        'merchant_viewer',
      ]);
      expect(mockLogtoService.assignUserRoles).toHaveBeenCalledWith(
        'logto_provisioned_1',
        ['role_viewer'],
      );
      expect(mockMail.sendCustomHtml).toHaveBeenCalledTimes(1);
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'logto_provisioned_1' }),
      );
      expect(result.provisioned).toBe(true);
      expect(result.inviteEmailSent).toBe(true);
    });

    it('permissions có revenue_report → assign merchant_finance', async () => {
      noDup();
      mockLogtoService.lookupByEmail.mockResolvedValue(null);
      mockLogtoService.createUser.mockResolvedValue('logto_fin');
      mockLogtoService.resolveRoleIdsByNames.mockResolvedValue(['role_fin']);
      mockModel.create.mockResolvedValue(makeDoc({ userId: 'logto_fin' }));

      await service.create(
        { ...emailDto, permissions: ['ticket_report', 'revenue_report'] },
        'admin_xyz',
      );

      expect(mockLogtoService.resolveRoleIdsByNames).toHaveBeenCalledWith([
        'merchant_finance',
      ]);
    });

    it('email ĐÃ có Logto → idempotent, KHÔNG createUser', async () => {
      noDup();
      mockLogtoService.lookupByEmail.mockResolvedValue({
        userId: 'logto_existing',
        email: 'new@btc.vn',
        name: 'Existing',
        username: null,
      });
      mockModel.create.mockResolvedValue(makeDoc({ userId: 'logto_existing' }));

      const result = await service.create(emailDto, 'admin_xyz');

      expect(mockLogtoService.createUser).not.toHaveBeenCalled();
      expect(mockMail.sendCustomHtml).not.toHaveBeenCalled();
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'logto_existing' }),
      );
      expect(result.provisioned).toBe(false);
    });

    it('Logto thiếu scope (LOGTO_M2M_UNCONFIGURED) → 400 PROVISION_NO_SCOPE, KHÔNG tạo record', async () => {
      noDup();
      mockLogtoService.lookupByEmail.mockResolvedValue(null);
      mockLogtoService.createUser.mockRejectedValue(
        new Error('LOGTO_M2M_UNCONFIGURED'),
      );

      await expect(service.create(emailDto, 'admin_xyz')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockModel.create).not.toHaveBeenCalled();
    });

    it('email gửi fail → user vẫn tạo, inviteEmailSent:false (không rollback)', async () => {
      noDup();
      mockLogtoService.lookupByEmail.mockResolvedValue(null);
      mockLogtoService.createUser.mockResolvedValue('logto_x');
      mockLogtoService.resolveRoleIdsByNames.mockResolvedValue(['r']);
      mockMail.sendCustomHtml.mockResolvedValue(false);
      mockModel.create.mockResolvedValue(makeDoc({ userId: 'logto_x' }));

      const result = await service.create(emailDto, 'admin_xyz');

      expect(mockModel.create).toHaveBeenCalled();
      expect(result.inviteEmailSent).toBe(false);
      expect(result.provisioned).toBe(true);
    });

    it('userId có sẵn → KHÔNG lookup/provision (M3 path)', async () => {
      noDup();
      mockModel.create.mockResolvedValue(makeDoc({ userId: 'logto_explicit' }));

      const result = await service.create(
        { ...emailDto, userId: 'logto_explicit' },
        'admin_xyz',
      );

      expect(mockLogtoService.lookupByEmail).not.toHaveBeenCalled();
      expect(mockLogtoService.createUser).not.toHaveBeenCalled();
      expect(result.provisioned).toBe(false);
    });
  });
});
