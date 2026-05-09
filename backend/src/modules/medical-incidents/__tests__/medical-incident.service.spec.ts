import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MedicalIncidentService } from '../services/medical-incident.service';
import { MedicalIncidentSseService } from '../services/sse-broadcaster.service';
import {
  MedicalIncident,
  IncidentState,
} from '../schemas/medical-incident.schema';
import { LogtoUser } from '../../logto-auth/types';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

const baseUser: LogtoUser = {
  userId: 'user-1',
  sub: 'user-1',
  email: 'a@b.c',
  role: 'admin',
  roles: ['admin', 'medic'],
  scopes: ['admin'],
};

const operatorUser: LogtoUser = {
  ...baseUser,
  userId: 'user-op',
  roles: [],
  scopes: [],
  role: 'user',
};

const directorUser: LogtoUser = {
  ...baseUser,
  userId: 'user-rd',
  roles: ['race_director'],
};

const validGps = {
  lat: 21.0285,
  lng: 105.8542,
  source: 'manual' as const,
};

const validRaceId = 'race-abc';
const validMongoRaceId = new Types.ObjectId().toString();

describe('MedicalIncidentService', () => {
  let service: MedicalIncidentService;
  let mockModel: any;
  let mockRedis: any;
  let mockSse: any;

  const mockIncidentDoc = (overrides: Partial<MedicalIncident> = {}) => ({
    _id: new Types.ObjectId(),
    raceId: validRaceId,
    severity: 3,
    category: 'musculoskeletal',
    state: 'REPORTED' as IncidentState,
    incidentTransitions: [
      {
        from: 'INITIAL',
        to: 'REPORTED',
        actorId: 'u1',
        actorRole: 'operator',
        at: new Date(),
      },
    ],
    medicalTeamAssigned: [],
    witnessStatements: [],
    attachments: [],
    gpsLocation: validGps,
    reportedByUserId: 'u1',
    reportedAt: new Date(),
    bib: '1001',
    anonymized: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    mockModel = {
      create: jest.fn().mockImplementation((doc: any) =>
        Promise.resolve({
          ...doc,
          _id: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      }),
      countDocuments: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };
    mockSse = { emit: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalIncidentService,
        { provide: getModelToken(MedicalIncident.name), useValue: mockModel },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        { provide: MedicalIncidentSseService, useValue: mockSse },
      ],
    }).compile();

    service = moduleRef.get(MedicalIncidentService);
  });

  // ---------- CREATE ----------
  describe('createIncident — happy path', () => {
    it('creates Sev 3 incident with bib + GPS + initial transition', async () => {
      const result = await service.createIncident(
        validRaceId,
        validMongoRaceId,
        {
          severity: 3,
          category: 'musculoskeletal',
          bib: '1001',
          gpsLocation: validGps,
        },
        baseUser,
      );

      expect(result.severity).toBe(3);
      expect(result.state).toBe('REPORTED');
      expect(mockSse.emit).toHaveBeenCalledWith(
        'incident.created',
        validRaceId,
        expect.objectContaining({ severity: 3 }),
      );
    });
  });

  describe('createIncident — BR-MI-24 validation', () => {
    it('rejects when bib + name + description all empty', async () => {
      await expect(
        service.createIncident(
          validRaceId,
          validMongoRaceId,
          {
            severity: 1,
            category: 'musculoskeletal',
            gpsLocation: validGps,
          },
          baseUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createIncident — BR-MI-26 Sev 4-5 photo required', () => {
    it('rejects Sev 4 incident without attachmentKeys', async () => {
      await expect(
        service.createIncident(
          validRaceId,
          validMongoRaceId,
          {
            severity: 4,
            category: 'cardiac',
            description: 'chest pain confirmed',
            gpsLocation: validGps,
          },
          baseUser,
        ),
      ).rejects.toThrow(/anh.*Sev 4-5|Cần tối thiểu 1 ảnh/i);
    });

    it('accepts Sev 5 with photo attached', async () => {
      const result = await service.createIncident(
        validRaceId,
        validMongoRaceId,
        {
          severity: 5,
          category: 'cardiac',
          description: 'cardiac arrest at km 30',
          gpsLocation: validGps,
          attachmentKeys: ['medical-attachments/race-abc/foo/1.jpg'],
        },
        baseUser,
      );
      expect(result.severity).toBe(5);
    });
  });

  describe('createIncident — BR-MI-10 "other" requires ≥10 char description', () => {
    it('rejects "other" with short description', async () => {
      await expect(
        service.createIncident(
          validRaceId,
          validMongoRaceId,
          {
            severity: 2,
            category: 'other',
            description: 'short',
            gpsLocation: validGps,
          },
          baseUser,
        ),
      ).rejects.toThrow(/Khác.*10|other.*10/i);
    });
  });

  describe('createIncident — BR-MI-08 trauma sub-type required', () => {
    it('rejects trauma without sub-type', async () => {
      await expect(
        service.createIncident(
          validRaceId,
          validMongoRaceId,
          {
            severity: 2,
            category: 'trauma',
            description: 'fall at km 5',
            gpsLocation: validGps,
          },
          baseUser,
        ),
      ).rejects.toThrow(/sub-type|Té ngã/i);
    });
  });

  // ---------- STATE MACHINE ----------
  describe('transitionStatus — forward-only matrix', () => {
    it('rejects backward transition HOSPITAL_TRANSFER → MEDIC_ON_SITE', async () => {
      mockModel.findOne.mockResolvedValue(
        mockIncidentDoc({ state: 'HOSPITAL_TRANSFER', severity: 4 }),
      );
      await expect(
        service.transitionStatus(
          validRaceId,
          new Types.ObjectId().toString(),
          { to: 'MEDIC_ON_SITE' },
          baseUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects skip past CLOSED (terminal state)', async () => {
      mockModel.findOne.mockResolvedValue(
        mockIncidentDoc({ state: 'CLOSED' }),
      );
      await expect(
        service.transitionStatus(
          validRaceId,
          new Types.ObjectId().toString(),
          { to: 'RESOLVED_ONSITE' },
          baseUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Lvl 1 shortcut REPORTED → RESOLVED_ONSITE allowed', async () => {
      const doc = mockIncidentDoc({ severity: 1 });
      mockModel.findOne.mockResolvedValue(doc);
      mockModel.findOneAndUpdate.mockResolvedValue({
        ...doc,
        state: 'RESOLVED_ONSITE',
      });
      const result = await service.transitionStatus(
        validRaceId,
        doc._id.toString(),
        { to: 'RESOLVED_ONSITE' },
        baseUser,
      );
      expect(result.state).toBe('RESOLVED_ONSITE');
    });
  });

  describe('transitionStatus — BR-MI-13 Sev 4-5 must hit MEDIC_ON_SITE/AMB_REQUESTED', () => {
    it('rejects Sev 4 REPORTED → RESOLVED_ONSITE without medic-on-site gate', async () => {
      mockModel.findOne.mockResolvedValue(
        mockIncidentDoc({ severity: 4, state: 'REPORTED' }),
      );
      await expect(
        service.transitionStatus(
          validRaceId,
          new Types.ObjectId().toString(),
          {
            to: 'RESOLVED_ONSITE',
          },
          baseUser,
        ),
      ).rejects.toThrow(/MEDIC_ON_SITE|AMB_REQUESTED/);
    });
  });

  describe('transitionStatus — BR-MI-14 FALSE_ALARM Race Director only', () => {
    it('rejects FALSE_ALARM by non-Race-Director', async () => {
      const doc = mockIncidentDoc({ severity: 1 });
      mockModel.findOne.mockResolvedValue(doc);
      await expect(
        service.transitionStatus(
          validRaceId,
          doc._id.toString(),
          {
            to: 'CLOSED',
            closureReason: 'FALSE_ALARM',
            reasonNote: 'Misclick',
            medicalDirectorSignature: {
              name: 'BS X',
              signedAt: new Date().toISOString(),
            },
          },
          operatorUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows FALSE_ALARM by Race Director with reason note', async () => {
      const doc = mockIncidentDoc({ severity: 1 });
      mockModel.findOne.mockResolvedValue(doc);
      mockModel.findOneAndUpdate.mockResolvedValue({
        ...doc,
        state: 'CLOSED',
        closureReason: 'FALSE_ALARM',
      });
      const result = await service.transitionStatus(
        validRaceId,
        doc._id.toString(),
        {
          to: 'CLOSED',
          closureReason: 'FALSE_ALARM',
          reasonNote: 'Athlete misreport',
          medicalDirectorSignature: {
            name: 'BS Y',
            signedAt: new Date().toISOString(),
          },
        },
        directorUser,
      );
      expect(result.state).toBe('CLOSED');
    });
  });

  describe('transitionStatus — A2 witness statements ≥2 for Sev 4-5 closure', () => {
    it('rejects Sev 5 → CLOSED with 1 witness only', async () => {
      const doc = mockIncidentDoc({
        severity: 5,
        state: 'HOSPITAL_TRANSFER',
        witnessStatements: [
          { name: 'W1', signedAt: new Date() } as any,
        ],
        // Pre-existing transitions so BR-MI-13 gate passes (MEDIC_ON_SITE seen).
        incidentTransitions: [
          { from: 'INITIAL', to: 'REPORTED', actorId: 'u1', actorRole: 'operator', at: new Date() } as any,
          { from: 'REPORTED', to: 'MEDIC_ON_SITE', actorId: 'u1', actorRole: 'medic', at: new Date() } as any,
          { from: 'MEDIC_ON_SITE', to: 'AMB_REQUESTED', actorId: 'u1', actorRole: 'medic', at: new Date() } as any,
          { from: 'AMB_REQUESTED', to: 'HOSPITAL_TRANSFER', actorId: 'u1', actorRole: 'medic', at: new Date() } as any,
        ],
      });
      mockModel.findOne.mockResolvedValue(doc);
      await expect(
        service.transitionStatus(
          validRaceId,
          doc._id.toString(),
          {
            to: 'CLOSED',
            closureReason: 'RESOLVED',
            medicalDirectorSignature: {
              name: 'BS Z',
              signedAt: new Date().toISOString(),
            },
          },
          baseUser,
        ),
      ).rejects.toThrow(/2.*witness|nhân chứng/i);
    });
  });

  describe('transitionStatus — BR-MI-16 downgrade requires reason_note', () => {
    it('rejects severity downgrade 3→1 without reasonNote', async () => {
      const doc = mockIncidentDoc({ severity: 3 });
      mockModel.findOne.mockResolvedValue(doc);
      await expect(
        service.transitionStatus(
          validRaceId,
          doc._id.toString(),
          {
            to: 'MEDIC_DISPATCHED',
            newSeverity: 1,
          },
          baseUser,
        ),
      ).rejects.toThrow(/reason_note|reason note/i);
    });
  });

  describe('transitionStatus — A1 multi-medic array append', () => {
    it('appends new medics via $addToSet (preserves existing)', async () => {
      const doc = mockIncidentDoc({
        severity: 3,
        medicalTeamAssigned: ['BS-A'],
      });
      mockModel.findOne.mockResolvedValue(doc);
      mockModel.findOneAndUpdate.mockImplementation((_q: any, update: any) => {
        expect(update.$addToSet?.medicalTeamAssigned).toEqual({
          $each: ['BS-B', 'BS-C'],
        });
        return Promise.resolve({
          ...doc,
          state: 'MEDIC_DISPATCHED',
          medicalTeamAssigned: ['BS-A', 'BS-B', 'BS-C'],
        });
      });
      const result = await service.transitionStatus(
        validRaceId,
        doc._id.toString(),
        {
          to: 'MEDIC_DISPATCHED',
          medicsToAssign: ['BS-B', 'BS-C'],
        },
        baseUser,
      );
      expect(result.medicalTeamAssigned).toEqual(['BS-A', 'BS-B', 'BS-C']);
    });
  });

  describe('transitionStatus — concurrent SETNX lock', () => {
    it('returns 409 when redis lock NX fails', async () => {
      mockRedis.set.mockResolvedValue(null); // NX failed
      await expect(
        service.transitionStatus(
          validRaceId,
          new Types.ObjectId().toString(),
          { to: 'MEDIC_DISPATCHED' },
          baseUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transitionStatus — A3 typed-name signature required at CLOSED', () => {
    it('rejects CLOSED transition without medicalDirectorSignature', async () => {
      const doc = mockIncidentDoc({ severity: 1 });
      mockModel.findOne.mockResolvedValue(doc);
      await expect(
        service.transitionStatus(
          validRaceId,
          doc._id.toString(),
          {
            to: 'CLOSED',
            closureReason: 'RESOLVED',
          },
          baseUser,
        ),
      ).rejects.toThrow(/medicalDirectorSignature/i);
    });
  });

  describe('transitionStatus — BR-MI-15 audit trail APPEND-ONLY', () => {
    it('uses $push (NOT $set) on incidentTransitions', async () => {
      const doc = mockIncidentDoc({ severity: 1 });
      mockModel.findOne.mockResolvedValue(doc);
      let captured: any;
      mockModel.findOneAndUpdate.mockImplementation((_q: any, update: any) => {
        captured = update;
        return Promise.resolve({ ...doc, state: 'MEDIC_DISPATCHED' });
      });
      await service.transitionStatus(
        validRaceId,
        doc._id.toString(),
        { to: 'MEDIC_DISPATCHED' },
        baseUser,
      );
      expect(captured.$push).toBeDefined();
      expect(captured.$push.incidentTransitions).toBeDefined();
      expect(captured.$set?.incidentTransitions).toBeUndefined();
    });
  });

  // ---------- PII REDACTION ----------
  describe('listIncidents — BR-MI-32 PII redaction for non-medical role', () => {
    it('strips athleteName + description + attachments[] for operator role', async () => {
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          mockIncidentDoc({
            athleteName: 'Nguyen Van X',
            description: 'leg injury',
            attachments: [
              {
                s3Key: 'k',
                mime: 'image/jpeg',
                sizeBytes: 1,
                uploadedAt: new Date(),
              },
            ],
          }),
        ]),
      });
      mockModel.countDocuments.mockResolvedValue(1);

      const result = await service.listIncidents(
        validRaceId,
        { limit: 10, offset: 0 },
        operatorUser,
      );
      expect(result.items[0].athleteName).toBeUndefined();
      expect(result.items[0].description).toBeUndefined();
      expect(result.items[0].attachments).toEqual([]);
    });

    it('preserves PII for medic role', async () => {
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          mockIncidentDoc({
            athleteName: 'Nguyen Van X',
            description: 'leg injury',
          }),
        ]),
      });
      mockModel.countDocuments.mockResolvedValue(1);
      const result = await service.listIncidents(
        validRaceId,
        { limit: 10, offset: 0 },
        baseUser, // has 'medic'
      );
      expect(result.items[0].athleteName).toBe('Nguyen Van X');
      expect(result.items[0].description).toBe('leg injury');
    });
  });

  // ---------- IDOR SECURITY ----------
  describe('getIncident — IDOR mitigation 404 not 403', () => {
    it('returns NotFoundException when incident in different race', async () => {
      mockModel.findOne.mockResolvedValue(null);
      await expect(
        service.getIncident(
          validRaceId,
          new Types.ObjectId().toString(),
          baseUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- STATIC HELPERS ----------
  describe('static getAllowedTransitions', () => {
    it('REPORTED can fan out to 6 forward states', () => {
      const allowed = MedicalIncidentService.getAllowedTransitions('REPORTED');
      expect(allowed).toContain('MEDIC_DISPATCHED');
      expect(allowed).toContain('MEDIC_ON_SITE');
      expect(allowed).toContain('CLOSED');
      expect(allowed).not.toContain('REPORTED');
      expect(allowed).not.toContain('HOSPITAL_TRANSFER');
    });

    it('CLOSED is terminal (zero transitions out)', () => {
      expect(MedicalIncidentService.getAllowedTransitions('CLOSED')).toEqual([]);
    });
  });

  describe('static isActiveState', () => {
    it('CLOSED + RESOLVED_* are NOT active', () => {
      expect(MedicalIncidentService.isActiveState('CLOSED')).toBe(false);
      expect(MedicalIncidentService.isActiveState('RESOLVED_ONSITE')).toBe(false);
      expect(MedicalIncidentService.isActiveState('RESOLVED_DNF')).toBe(false);
    });

    it('REPORTED through HOSPITAL_TRANSFER are active', () => {
      expect(MedicalIncidentService.isActiveState('REPORTED')).toBe(true);
      expect(MedicalIncidentService.isActiveState('MEDIC_ON_SITE')).toBe(true);
      expect(MedicalIncidentService.isActiveState('HOSPITAL_TRANSFER')).toBe(true);
    });
  });
});
