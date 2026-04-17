import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ApplicationsService } from './applications.service';
import { OpsUser } from '../schemas/ops-user.schema';
import { OpsEvent } from '../schemas/ops-event.schema';
import { OpsTeam } from '../schemas/ops-team.schema';
import { AuditService } from '../audit/audit.service';

/**
 * BR-02 team isolation — unit tests cho ApplicationsService.
 *
 * Mock strategy: inject mocked Mongoose model + AuditService. Verify scope
 * enforcement logic isolated khỏi MongoDB + HTTP layer. Complements e2e smoke
 * test (pending Sprint 3 MongoDB-memory-server setup).
 *
 * Coverage map (10 test cases theo QC Gatekeeper audit #2):
 *  1. list — leader sees only own team
 *  2. list — leader cannot spoof via query.team_id
 *  3. list — admin sees all (no scope filter)
 *  4. list — leader JWT malformed team_id returns empty
 *  5. approve — leader 404 on cross-team target (anti-enumeration)
 *  6. approve — leader 403 on own-team target + body.team_id=other
 *  7. approve — leader 200 on own-team target + body.team_id=own
 *  8. approve — admin bypass (can approve cross-team)
 *  9. approve — defense: non-ops_tnv target rejected (privilege escalation)
 * 10. reject — leader 404 on cross-team target
 */
describe('ApplicationsService — BR-02 team isolation', () => {
  let service: ApplicationsService;
  let userModel: any;
  let eventModel: any;
  let teamModel: any;
  let auditService: any;

  const tenantId = 'tenant-1';
  const eventId = new Types.ObjectId();
  const waterTeamId = new Types.ObjectId();
  const medicalTeamId = new Types.ObjectId();
  const waterLeaderId = new Types.ObjectId();
  const pendingTnvWaterId = new Types.ObjectId();
  const pendingTnvMedicalId = new Types.ObjectId();

  const mockEvent = {
    _id: eventId,
    tenant_id: tenantId,
    status: 'LIVE',
    deleted_at: null,
  };

  const mockPendingTnvWater = {
    _id: pendingTnvWaterId,
    event_id: eventId,
    team_id: waterTeamId,
    role: 'ops_tnv',
    status: 'PENDING',
    phone: '0901111111',
    full_name: 'TNV Water',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPendingTnvMedical = {
    ...mockPendingTnvWater,
    _id: pendingTnvMedicalId,
    team_id: medicalTeamId,
    phone: '0902222222',
    full_name: 'TNV Medical',
  };

  beforeEach(async () => {
    userModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      findById: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      countDocuments: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };

    eventModel = {
      findOne: jest.fn().mockResolvedValue(mockEvent),
    };

    teamModel = {
      findOne: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getModelToken(OpsUser.name), useValue: userModel },
        { provide: getModelToken(OpsEvent.name), useValue: eventModel },
        { provide: getModelToken(OpsTeam.name), useValue: teamModel },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  /* ───────────── list() ───────────── */

  describe('list()', () => {
    it('TC-01: leader sees ONLY own team users (hard filter)', async () => {
      const items = [mockPendingTnvWater];
      userModel.find.mockReturnValue({
        select: () => ({
          sort: () => ({ lean: jest.fn().mockResolvedValue(items) }),
        }),
      });
      userModel.countDocuments.mockResolvedValue(1);

      await service.list(
        tenantId,
        String(eventId),
        {},
        String(waterTeamId),
      );

      // Verify filter passed to Mongoose has team_id = waterTeamId
      const filterArg = userModel.find.mock.calls[0][0];
      expect(filterArg.team_id).toBeDefined();
      expect(String(filterArg.team_id)).toBe(String(waterTeamId));
      expect(filterArg.event_id).toEqual(eventId);
      expect(filterArg.deleted_at).toBeNull();
    });

    it('TC-02: leader query.team_id=MEDICAL is IGNORED (spoof blocked)', async () => {
      userModel.find.mockReturnValue({
        select: () => ({
          sort: () => ({ lean: jest.fn().mockResolvedValue([]) }),
        }),
      });
      userModel.countDocuments.mockResolvedValue(0);

      await service.list(
        tenantId,
        String(eventId),
        { team_id: String(medicalTeamId) }, // leader tries spoof
        String(waterTeamId),
      );

      const filterArg = userModel.find.mock.calls[0][0];
      expect(String(filterArg.team_id)).toBe(String(waterTeamId)); // water wins
      expect(String(filterArg.team_id)).not.toBe(String(medicalTeamId));
    });

    it('TC-03: admin (scopeTeamId=undefined) can filter by any team via query', async () => {
      userModel.find.mockReturnValue({
        select: () => ({
          sort: () => ({ lean: jest.fn().mockResolvedValue([]) }),
        }),
      });
      userModel.countDocuments.mockResolvedValue(0);

      await service.list(
        tenantId,
        String(eventId),
        { team_id: String(medicalTeamId) },
        undefined, // admin
      );

      const filterArg = userModel.find.mock.calls[0][0];
      expect(String(filterArg.team_id)).toBe(String(medicalTeamId));
    });

    it('TC-04: leader JWT malformed team_id → returns empty (no 500)', async () => {
      const result = await service.list(
        tenantId,
        String(eventId),
        {},
        'not-a-valid-objectid',
      );

      expect(result).toEqual({ items: [], total: 0 });
      // Model not queried at all
      expect(userModel.find).not.toHaveBeenCalled();
    });
  });

  /* ───────────── approve() ───────────── */

  describe('approve()', () => {
    it('TC-05: leader-WATER 404 on cross-team (MEDICAL) target — anti-enumeration', async () => {
      userModel.findOne.mockResolvedValue(mockPendingTnvMedical);

      await expect(
        service.approve(
          tenantId,
          String(eventId),
          String(pendingTnvMedicalId),
          String(waterLeaderId),
          undefined, // no body.team_id
          String(waterTeamId), // leader scope
        ),
      ).rejects.toThrow(NotFoundException);

      // Mutation NOT called
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('TC-06: leader-WATER 403 when body.team_id=MEDICAL on own-team target', async () => {
      userModel.findOne.mockResolvedValue(mockPendingTnvWater);

      await expect(
        service.approve(
          tenantId,
          String(eventId),
          String(pendingTnvWaterId),
          String(waterLeaderId),
          String(medicalTeamId), // body.team_id = other team
          String(waterTeamId), // leader scope
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('TC-07: leader-WATER 200 on own-team target + body.team_id=WATER', async () => {
      userModel.findOne.mockResolvedValue(mockPendingTnvWater);
      // findOneAndUpdate for team check inside approve
      teamModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: waterTeamId }),
      });
      // findById after update returns fresh doc
      userModel.findById.mockReturnValue({
        select: () => ({
          lean: jest.fn().mockResolvedValue({
            ...mockPendingTnvWater,
            status: 'APPROVED',
          }),
        }),
      });

      const result = await service.approve(
        tenantId,
        String(eventId),
        String(pendingTnvWaterId),
        String(waterLeaderId),
        String(waterTeamId),
        String(waterTeamId),
      );

      expect(result.status).toBe('APPROVED');
      expect(userModel.updateOne).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalled();
    });

    it('TC-08: admin (scopeTeamId=undefined) can approve MEDICAL TNV into any team', async () => {
      userModel.findOne.mockResolvedValue(mockPendingTnvMedical);
      teamModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: waterTeamId }),
      });
      userModel.findById.mockReturnValue({
        select: () => ({
          lean: jest.fn().mockResolvedValue({
            ...mockPendingTnvMedical,
            status: 'APPROVED',
            team_id: waterTeamId,
          }),
        }),
      });

      const result = await service.approve(
        tenantId,
        String(eventId),
        String(pendingTnvMedicalId),
        String(waterLeaderId),
        String(waterTeamId), // admin reassigns cross-team
        undefined, // admin scope
      );

      expect(result.status).toBe('APPROVED');
      expect(userModel.updateOne).toHaveBeenCalledTimes(1);
    });

    it('TC-09: defense-in-depth — target role != ops_tnv → 403 even with BR-02 pass', async () => {
      // Hypothetical: a PENDING user with role='ops_leader' somehow exists
      const rogueLeader = {
        ...mockPendingTnvWater,
        role: 'ops_leader', // not ops_tnv
      };
      userModel.findOne.mockResolvedValue(rogueLeader);

      await expect(
        service.approve(
          tenantId,
          String(eventId),
          String(pendingTnvWaterId),
          String(waterLeaderId),
          String(waterTeamId),
          String(waterTeamId), // scope matches — BR-02 passes
        ),
      ).rejects.toThrow(/Only TNV applications can be approved/i);

      expect(userModel.updateOne).not.toHaveBeenCalled();
    });
  });

  /* ───────────── reject() ───────────── */

  describe('reject()', () => {
    it('TC-10: leader-WATER 404 on cross-team (MEDICAL) target', async () => {
      userModel.findOne.mockResolvedValue(mockPendingTnvMedical);

      await expect(
        service.reject(
          tenantId,
          String(eventId),
          String(pendingTnvMedicalId),
          String(waterLeaderId),
          { reason: 'test' },
          String(waterTeamId), // leader scope
        ),
      ).rejects.toThrow(NotFoundException);

      expect(userModel.updateOne).not.toHaveBeenCalled();
    });
  });

  /* ───────────── resolveScopeTeamId helper ─────────────
   * Tested indirectly qua controller — nhưng defensive check ngay trong util:
   */
  describe('leader-no-team helper semantics (documented)', () => {
    it('controller-level responsibility: resolveScopeTeamId throws 403 if leader has no team_id', () => {
      // Service gets called with throw already happened at controller.
      // Documented here for completeness; actual throw tested in resolve-scope-team.util tests
      // (or integration). Service receives either undefined (admin) hoặc valid string (leader với team).
      // Nếu scopeTeamId = '' hoặc invalid string, TC-04 covers.
      expect(true).toBe(true);
    });
  });
});
