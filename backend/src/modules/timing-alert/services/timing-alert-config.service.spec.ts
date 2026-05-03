import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TimingAlertConfigService } from './timing-alert-config.service';
import { TimingAlertConfig } from '../schemas/timing-alert-config.schema';
import { ApiKeyCrypto } from '../crypto/api-key.crypto';

/**
 * Integration-style spec: real ApiKeyCrypto (with test env key) + mocked
 * Mongoose model. Verify encrypt-on-write + mask-on-read end-to-end.
 */
describe('TimingAlertConfigService', () => {
  let service: TimingAlertConfigService;
  let mockModel: any;
  const testKey = crypto.randomBytes(32).toString('hex');

  beforeAll(() => {
    process.env.TIMING_ALERT_ENCRYPTION_KEY = testKey;
    jest.resetModules();
  });

  beforeEach(async () => {
    mockModel = {
      findOneAndUpdate: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    // Use REAL ApiKeyCrypto — test thật encrypt/decrypt flow
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimingAlertConfigService,
        ApiKeyCrypto,
        { provide: getModelToken(TimingAlertConfig.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<TimingAlertConfigService>(TimingAlertConfigService);
  });

  describe('upsert()', () => {
    const validDto = {
      rr_event_id: '396207',
      rr_api_keys: {
        '5KM': 'LE2KXEYOAR6H4YLKGMSXPDT989IQ7VWA',
        '42KM': 'NFSJ1OMPKSSU35EWUD8XR8NJQBOFAS1Q',
      },
      course_checkpoints: {
        '5KM': [
          { key: 'Start', distance_km: 0 },
          { key: 'Finish', distance_km: 5 },
        ],
        '42KM': [
          { key: 'Start', distance_km: 0 },
          { key: 'TM1', distance_km: 10 },
          { key: 'Finish', distance_km: 42.195 },
        ],
      },
      enabled: true,
    };

    it('encrypts each API key before save (TA-2)', async () => {
      const savedDoc: any = {
        _id: 'config-1',
        mysql_race_id: 192,
        rr_event_id: '396207',
        rr_api_keys: {}, // captured below
        course_checkpoints: validDto.course_checkpoints,
        cutoff_times: {},
        poll_interval_seconds: 90,
        overdue_threshold_minutes: 30,
        top_n_alert: 3,
        enabled: true,
        enabled_by_user_id: 'admin@5bib.com',
        enabled_at: new Date(),
        last_polled_at: null,
      };
      mockModel.findOneAndUpdate.mockImplementation((filter: any, update: any) => {
        savedDoc.rr_api_keys = update.$set.rr_api_keys;
        return { exec: () => Promise.resolve(savedDoc) };
      });

      await service.upsert(192, validDto, 'admin@5bib.com');

      // Each saved value MUST be ciphertext format `iv:tag:ct`, NOT plaintext
      for (const [course, ct] of Object.entries(savedDoc.rr_api_keys)) {
        expect(ct).not.toBe(validDto.rr_api_keys[course as '5KM' | '42KM']);
        expect(ct as string).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
        expect((ct as string).split(':')).toHaveLength(3);
      }
    });

    it('returns masked response (no plaintext leak in API)', async () => {
      mockModel.findOneAndUpdate.mockImplementation(() => ({
        exec: () =>
          Promise.resolve({
            _id: 'c1',
            mysql_race_id: 192,
            rr_event_id: '396207',
            rr_api_keys: {},
            course_checkpoints: validDto.course_checkpoints,
            cutoff_times: {},
            poll_interval_seconds: 90,
            overdue_threshold_minutes: 30,
            top_n_alert: 3,
            enabled: true,
          }),
      }));

      const result = await service.upsert(192, validDto, 'admin');

      expect(result.rr_api_keys_masked['5KM']).toBe('LE2K...7VWA (32 chars)');
      expect(result.rr_api_keys_masked['42KM']).toBe('NFSJ...AS1Q (32 chars)');
      // Response object MUST NOT contain plaintext
      const json = JSON.stringify(result);
      expect(json).not.toContain('LE2KXEYOAR6H4YLKGMSXPDT989IQ7VWA');
      expect(json).not.toContain('NFSJ1OMPKSSU35EWUD8XR8NJQBOFAS1Q');
    });

    it('rejects empty rr_api_keys (BadRequest)', async () => {
      const dto = { ...validDto, rr_api_keys: {} };
      await expect(service.upsert(192, dto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects empty string API key', async () => {
      const dto = { ...validDto, rr_api_keys: { '5KM': '   ' } };
      await expect(service.upsert(192, dto, 'admin')).rejects.toThrow(
        /không rỗng/,
      );
    });

    it('rejects course in rr_api_keys but not in course_checkpoints', async () => {
      const dto = {
        ...validDto,
        rr_api_keys: { '99KM': 'KEY' },
        course_checkpoints: { '5KM': validDto.course_checkpoints['5KM'] },
      };
      await expect(service.upsert(192, dto, 'admin')).rejects.toThrow(
        /KHÔNG có trong course_checkpoints/,
      );
    });
  });

  describe('decryptKeyForPoll()', () => {
    it('decrypts API key for poll engine', async () => {
      const apiKeyCrypto = new ApiKeyCrypto();
      const plaintext = 'POLL_TEST_KEY_32_CHARACTERS_123456';
      const ct = apiKeyCrypto.encrypt(plaintext);

      mockModel.exec.mockResolvedValue({
        rr_api_keys: { '42KM': ct },
      });

      const result = await service.decryptKeyForPoll(192, '42KM');
      expect(result).toBe(plaintext);
    });

    it('throws NotFound when config missing', async () => {
      mockModel.exec.mockResolvedValue(null);
      await expect(service.decryptKeyForPoll(999, '42KM')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when course key missing', async () => {
      mockModel.exec.mockResolvedValue({ rr_api_keys: { '5KM': 'someCt' } });
      await expect(service.decryptKeyForPoll(192, '99KM')).rejects.toThrow(
        /No API key configured/,
      );
    });
  });

  describe('getByRaceId()', () => {
    it('returns null when not found', async () => {
      mockModel.exec.mockResolvedValue(null);
      const result = await service.getByRaceId(192);
      expect(result).toBeNull();
    });

    it('returns masked response for existing config', async () => {
      const apiKeyCrypto = new ApiKeyCrypto();
      const ct = apiKeyCrypto.encrypt('LE2KXEYOAR6H4YLKGMSXPDT989IQ7VWA');

      mockModel.exec.mockResolvedValue({
        _id: 'c1',
        mysql_race_id: 192,
        rr_event_id: '396207',
        rr_api_keys: { '5KM': ct },
        course_checkpoints: { '5KM': [] },
        cutoff_times: {},
        poll_interval_seconds: 90,
        overdue_threshold_minutes: 30,
        top_n_alert: 3,
        enabled: true,
      });

      const result = await service.getByRaceId(192);
      expect(result).not.toBeNull();
      expect(result!.rr_api_keys_masked['5KM']).toBe('LE2K...7VWA (32 chars)');
    });
  });
});
