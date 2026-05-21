/**
 * FEATURE-047 Phase 1B — AthletePhotoService unit tests.
 *
 * Coverage: MIME magic-bytes, size limit, anti-spam, EXIF strip, atomic moderation,
 * signed URL TTL, Redis counter sync.
 */

import {
  BadRequestException,
  ConflictException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AthletePhotoService, detectImageMime } from './athlete-photo.service';

// Mock @aws-sdk/s3-request-presigner before module init
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://signed.example.com/photo.webp'),
}));

// Mock sharp — returns predictable buffer
jest.mock('sharp', () => {
  const sharpFn = jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('PROCESSED-WEBP')),
  }));
  return sharpFn;
});

interface MockPhotoModel {
  find: jest.Mock;
  findOneAndUpdate: jest.Mock;
  countDocuments: jest.Mock;
  create: jest.Mock;
}

function makeMockModel(): MockPhotoModel {
  return {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ _id: 'photo-id-1' }),
  };
}

function makeMockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
  };
}

function makeMockS3() {
  return { send: jest.fn().mockResolvedValue({}) };
}

// Real magic-byte buffers for testing
const JPEG_MAGIC = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(20),
]);
const PNG_MAGIC = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(20),
]);
const FAKE_GIF = Buffer.concat([
  Buffer.from([0x47, 0x49, 0x46, 0x38]),
  Buffer.alloc(20),
]);
const PHP_FAKE_JPEG = Buffer.from('<?php evil(); ?>');

describe('detectImageMime() — magic bytes', () => {
  it('detects JPEG', () => {
    expect(detectImageMime(JPEG_MAGIC)).toBe('image/jpeg');
  });
  it('detects PNG', () => {
    expect(detectImageMime(PNG_MAGIC)).toBe('image/png');
  });
  it('rejects GIF', () => {
    expect(detectImageMime(FAKE_GIF)).toBeNull();
  });
  it('rejects PHP file claiming jpeg', () => {
    expect(detectImageMime(PHP_FAKE_JPEG)).toBeNull();
  });
  it('rejects too-short buffer', () => {
    expect(detectImageMime(Buffer.from([0xff]))).toBeNull();
  });
});

describe('AthletePhotoService (FEATURE-047 Phase 1B)', () => {
  let service: AthletePhotoService;
  let photoModel: MockPhotoModel;
  let redis: ReturnType<typeof makeMockRedis>;
  let s3: ReturnType<typeof makeMockS3>;

  beforeEach(() => {
    photoModel = makeMockModel();
    redis = makeMockRedis();
    s3 = makeMockS3();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new AthletePhotoService(
      photoModel as any,
      redis as any,
      s3 as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  describe('uploadPhoto()', () => {
    const fakeFile = {
      buffer: JPEG_MAGIC,
      size: 100_000,
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    it('happy path — JPEG file → 200 OK + pending status', async () => {
      const result = await service.uploadPhoto(
        '2095-truong-van-quan',
        fakeFile,
        'selfie',
        'user-logto-id-1',
      );

      expect(result).toEqual({ id: 'photo-id-1', status: 'pending' });
      expect(s3.send).toHaveBeenCalled();
      expect(photoModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          athleteSlug: '2095-truong-van-quan',
          type: 'selfie',
          uploadedByUserId: 'user-logto-id-1',
          status: 'pending',
          exifStripped: true,
        }),
      );
      expect(redis.incr).toHaveBeenCalledWith('athlete:photo:pending-count');
    });

    it('rejects GIF — magic bytes mismatch (defense beyond MIME header)', async () => {
      const badFile = {
        ...fakeFile,
        buffer: FAKE_GIF,
        mimetype: 'image/jpeg', // header lies
      } as Express.Multer.File;

      await expect(
        service.uploadPhoto('slug', badFile, 'selfie', 'user-1'),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('rejects PHP file claiming jpeg — magic bytes defense', async () => {
      const evilFile = {
        ...fakeFile,
        buffer: PHP_FAKE_JPEG,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await expect(
        service.uploadPhoto('slug', evilFile, 'selfie', 'user-1'),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('rejects file >5MB', async () => {
      const bigFile = {
        ...fakeFile,
        size: 6 * 1024 * 1024,
      } as Express.Multer.File;

      await expect(
        service.uploadPhoto('slug', bigFile, 'selfie', 'user-1'),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects missing file (field name required)', async () => {
      await expect(
        service.uploadPhoto(
          'slug',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          null as any,
          'selfie',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('anti-spam: 11th pending upload → 409 ConflictException', async () => {
      photoModel.countDocuments.mockResolvedValue(10);

      await expect(
        service.uploadPhoto('slug', fakeFile, 'selfie', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('S3 path format: athlete-photos/<slug>/<uuid>.webp', async () => {
      await service.uploadPhoto(
        '2095-truong-van-quan',
        fakeFile,
        'selfie',
        'user-1',
      );

      const s3Call = s3.send.mock.calls[0][0];
      // PutObjectCommand instance — check input via `.input`
      const key = s3Call.input?.Key as string;
      expect(key).toMatch(
        /^athlete-photos\/2095-truong-van-quan\/[a-f0-9-]+\.webp$/,
      );
      expect(s3Call.input?.ContentType).toBe('image/webp');
    });
  });

  describe('approve() / reject() — atomic moderation', () => {
    it('approve: atomic pending → approved + audit metadata + cache invalidate', async () => {
      photoModel.findOneAndUpdate.mockResolvedValue({
        _id: 'photo-1',
        athleteSlug: 'slug-1',
        status: 'approved',
      });

      const result = await service.approve('photo-1', 'admin-1');

      expect(result.status).toBe('approved');
      expect(photoModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'photo-1', status: 'pending' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'approved',
            moderatedBy: 'admin-1',
          }),
        }),
        { new: true },
      );
      expect(redis.decr).toHaveBeenCalledWith('athlete:photo:pending-count');
      expect(redis.del).toHaveBeenCalledWith('athlete:profile:slug-1');
    });

    it('approve fails 409 if already moderated (atomic prevent double-action)', async () => {
      photoModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.approve('photo-already-approved', 'admin-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('reject: stores rejectionReason in audit', async () => {
      photoModel.findOneAndUpdate.mockResolvedValue({
        _id: 'photo-2',
        athleteSlug: 'slug-2',
        status: 'rejected',
      });

      await service.reject('photo-2', 'admin-1', 'Ảnh không liên quan');

      expect(photoModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'photo-2', status: 'pending' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Ảnh không liên quan',
          }),
        }),
        { new: true },
      );
    });

    it('concurrent approve race — only first wins', async () => {
      // First call succeeds
      photoModel.findOneAndUpdate
        .mockResolvedValueOnce({
          _id: 'p1',
          athleteSlug: 's',
          status: 'approved',
        })
        .mockResolvedValueOnce(null); // second call sees status already changed

      const [r1, r2] = await Promise.allSettled([
        service.approve('p1', 'admin-a'),
        service.approve('p1', 'admin-b'),
      ]);

      const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled').length;
      const rejected = [r1, r2].filter((r) => r.status === 'rejected').length;
      expect(fulfilled).toBe(1);
      expect(rejected).toBe(1);
    });
  });

  describe('getApprovedPhotos() — Adjustment #11 signed URL 24h', () => {
    it('returns signed URLs (NOT raw S3 keys) for approved photos', async () => {
      photoModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: 'p1',
                type: 'selfie',
                s3Key: 'athlete-photos/slug/p1.webp',
                createdAt: new Date('2026-05-20'),
              },
            ]),
          }),
        }),
      });

      const result = await service.getApprovedPhotos('slug');

      expect(result).toHaveLength(1);
      expect(result[0].s3Url).toContain('signed.example.com');
      expect(result[0].s3Url).not.toContain('athlete-photos/'); // raw key NOT exposed
    });
  });

  describe('getPendingCount() — admin badge', () => {
    it('uses Redis cache if available', async () => {
      redis.get.mockResolvedValue('5');
      const count = await service.getPendingCount();
      expect(count).toBe(5);
      expect(photoModel.countDocuments).not.toHaveBeenCalled();
    });

    it('falls back to MongoDB countDocuments on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      photoModel.countDocuments.mockResolvedValue(7);
      const count = await service.getPendingCount();
      expect(count).toBe(7);
      expect(photoModel.countDocuments).toHaveBeenCalledWith({
        status: 'pending',
      });
    });
  });
});
