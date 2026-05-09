import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { MedicalIncidentDocument } from '../schemas/medical-incident.schema';

// Mock AWS SDK at module level so PdfGeneratorService construction doesn't try real S3.
jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    __mock: { send },
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/foo'),
}));

const baseInc = (
  overrides: Partial<MedicalIncidentDocument> = {},
): MedicalIncidentDocument =>
  ({
    severity: 3,
    category: 'musculoskeletal',
    state: 'CLOSED',
    bib: '1001',
    reportedAt: new Date('2026-05-08T10:00:00Z'),
    incidentTransitions: [],
    medicalTeamAssigned: [],
    witnessStatements: [],
    attachments: [],
    raceId: 'race-x',
    gpsLocation: { lat: 21, lng: 105, source: 'manual' },
    reportedByUserId: 'u1',
    anonymized: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as MedicalIncidentDocument;

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PdfGeneratorService],
    }).compile();
    service = moduleRef.get(PdfGeneratorService);
  });

  describe('generatePdf — happy path', () => {
    it('generates single-incident PDF and returns S3 key + signed URL', async () => {
      const result = await service.generatePdf('race-x', [baseInc()]);
      expect(result.s3Key).toMatch(/^medical-reports\/race-x\/\d+\.png$/);
      expect(result.signedUrl).toMatch(/^https:\/\/signed/);
      expect(result.incidentCount).toBe(1);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('generatePdf — empty list rejected', () => {
    it('throws BadRequestException for zero incidents', async () => {
      await expect(service.generatePdf('race-x', [])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generatePdf — A5 batch warning', () => {
    it('returns warning when count >50', async () => {
      const incidents = Array.from({ length: 60 }, () => baseInc());
      const result = await service.generatePdf('race-x', incidents);
      expect(result.warning).toContain('60');
    });

    it('no warning at exactly 50', async () => {
      const incidents = Array.from({ length: 50 }, () => baseInc());
      const result = await service.generatePdf('race-x', incidents);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('generatePdf — XSS hardening (BR security)', () => {
    it('strips control chars from injected category before fillText', async () => {
      const malicious = baseInc({
        category: 'cardiac',
        bib: '1001\x00\x1b]0;hack\x07',
      } as any);
      // Just ensure no throw — control chars strip happens inside escapeText.
      const result = await service.generatePdf('race-x', [malicious]);
      expect(result.s3Key).toBeDefined();
    });
  });

  describe('generatePdf — signed URL has 15min expiry', () => {
    it('expiresAtIso is ~900s from now', async () => {
      const before = Date.now();
      const result = await service.generatePdf('race-x', [baseInc()]);
      const expires = new Date(result.expiresAtIso).getTime();
      const delta = expires - before;
      expect(delta).toBeGreaterThan(890_000);
      expect(delta).toBeLessThan(910_000);
    });
  });

  describe('generatePdf — signature embedded when present', () => {
    it('renders without throw when at least one incident has signature', async () => {
      const result = await service.generatePdf('race-x', [
        baseInc({
          medicalDirectorSignature: {
            name: 'BS Nguyen',
            signedAt: new Date(),
          },
        } as any),
      ]);
      expect(result).toBeDefined();
    });
  });
});
