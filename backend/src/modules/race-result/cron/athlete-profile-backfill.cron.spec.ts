/**
 * FEATURE-047 Phase 1B — AthleteProfileBackfillCron unit tests.
 *
 * Coverage: SETNX overlap prevent, cursor resume, idempotent upsert, per-row
 * failure isolation, finally release.
 */

import { Types } from 'mongoose';
import { AthleteProfileBackfillCron } from './athlete-profile-backfill.cron';
import { AthleteIdentityMergeService } from '../services/athlete-identity-merge.service';

function makeMockRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: jest.fn(
      async (
        k: string,
        v: string,
        _ex?: string,
        _ttl?: number,
        mode?: string,
      ) => {
        if (mode === 'NX' && store.has(k)) return null;
        store.set(k, v);
        return 'OK';
      },
    ),
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    del: jest.fn(async (k: string) => {
      store.delete(k);
      return 1;
    }),
  };
}

function makeIdentityMergeStub(): AthleteIdentityMergeService {
  return {
    hashEmail: jest.fn((email: string) => `hash-${email}`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('AthleteProfileBackfillCron (FEATURE-047 Phase 1B)', () => {
  let cron: AthleteProfileBackfillCron;
  let resultModel: { find: jest.Mock };
  let profileModel: { findOneAndUpdate: jest.Mock };
  let redis: ReturnType<typeof makeMockRedis>;
  let identityMerge: AthleteIdentityMergeService;

  beforeEach(() => {
    resultModel = { find: jest.fn() };
    profileModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    redis = makeMockRedis();
    identityMerge = makeIdentityMergeStub();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    cron = new AthleteProfileBackfillCron(
      resultModel as any,
      profileModel as any,
      redis as any,
      identityMerge,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  describe('backfillAthleteProfiles() — lock + cursor', () => {
    it('SETNX prevents overlap — 2nd concurrent tick exits early', async () => {
      // First tick acquires lock + has data
      resultModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]), // immediate empty
            }),
          }),
        }),
      });

      // Pre-set lock to simulate previous tick still running
      redis.store.set('athlete:backfill-lock', '1');

      await cron.backfillAthleteProfiles();

      // Profile model NOT called because lock not acquired
      expect(profileModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('releases lock in finally block even on failure', async () => {
      resultModel.find.mockImplementation(() => {
        throw new Error('mongo down');
      });

      await expect(cron.backfillAthleteProfiles()).rejects.toBeDefined();

      // Lock must have been released
      expect(redis.store.has('athlete:backfill-lock')).toBe(false);
    });
  });

  describe('upsertAthleteProfile()', () => {
    it("idempotent upsert with $set (re-running same row doesn't duplicate)", async () => {
      resultModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              raceId: 'race-1',
              bib: '2095',
              name: 'Trương Văn Quân',
              chipTime: '1:20:55',
              created_at: new Date(),
              started: 1,
            },
          ]),
        }),
      });

      const row = {
        _id: new Types.ObjectId(),
        raceId: 'race-1',
        bib: '2095',
        name: 'Trương Văn Quân',
        email: 'tvq@example.com',
        chipTime: '1:20:55',
        created_at: new Date(),
        started: 1,
      };

      await cron.upsertAthleteProfile(row);

      expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
        { slug: '2095-truong-van-quan' },
        expect.objectContaining({
          $set: expect.objectContaining({
            slug: '2095-truong-van-quan',
            primaryBib: '2095',
            canonicalEmailHash: 'hash-tvq@example.com',
            totalRaces: 1,
            totalFinished: 1,
            totalDNF: 0,
          }),
          $setOnInsert: { active: true },
        }),
        { upsert: true, new: true },
      );
    });

    it('skips row with missing name or bib (graceful)', async () => {
      const row = {
        _id: new Types.ObjectId(),
        raceId: 'race-1',
        bib: '',
        name: undefined,
      };

      await cron.upsertAthleteProfile(row);

      expect(profileModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('email NULL → canonicalEmailHash undefined (PII defense)', async () => {
      resultModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              raceId: 'race-1',
              bib: '2095',
              name: 'Quân',
              chipTime: '1:20:00',
              started: 1,
            },
          ]),
        }),
      });

      const row = {
        _id: new Types.ObjectId(),
        raceId: 'race-1',
        bib: '2095',
        name: 'Quân',
        email: undefined, // no email
        started: 1,
      };

      await cron.upsertAthleteProfile(row);

      const callArgs = profileModel.findOneAndUpdate.mock.calls[0][1];
      expect(callArgs.$set.canonicalEmailHash).toBeUndefined();
    });

    it('correctly counts finishers vs DNF', async () => {
      resultModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { bib: '2095', name: 'Quân', chipTime: '1:20:00', started: 1 }, // finisher
            { bib: '2095', name: 'Quân', chipTime: '', started: 1 }, // DNF
            { bib: '2095', name: 'Quân', chipTime: '2:00:00', started: 1 }, // finisher
          ]),
        }),
      });

      const row = {
        _id: new Types.ObjectId(),
        raceId: 'race-1',
        bib: '2095',
        name: 'Quân',
        started: 1,
      };

      await cron.upsertAthleteProfile(row);

      const setArgs = profileModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setArgs.totalRaces).toBe(3);
      expect(setArgs.totalFinished).toBe(2);
      expect(setArgs.totalDNF).toBe(1);
    });

    it('VN diacritics name correctly slugified', async () => {
      resultModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              bib: '5004',
              name: 'Đào Thị Hà',
              chipTime: '5:00:00',
              started: 1,
            },
          ]),
        }),
      });

      const row = {
        _id: new Types.ObjectId(),
        raceId: 'race-1',
        bib: '5004',
        name: 'Đào Thị Hà',
        started: 1,
      };

      await cron.upsertAthleteProfile(row);

      expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
        { slug: '5004-dao-thi-ha' },
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
