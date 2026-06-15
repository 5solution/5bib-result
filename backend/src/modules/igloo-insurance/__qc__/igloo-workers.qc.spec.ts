/**
 * FEATURE-085 — QC worker tests (submit + poll). Mock HTTP + requestService +
 * redis → KHÔNG cần Igloo thật / DB / Redis. Config mock với 2 flag = true để
 * vào nhánh xử lý (gating-off verify bằng source assertion + getConfig test).
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../../config', () => ({
  env: {
    igloo: {
      baseUrl: 'https://igloo.test',
      apiKey: 'test-key',
      dailyCount: 10,
      cronHour: 9,
      dailyEnabled: true,
      submitEnabled: true,
    },
  },
}));

import { IglooSubmitWorkerCron } from '../crons/igloo-submit-worker.cron';
import { IglooPollWorkerCron } from '../crons/igloo-poll-worker.cron';

type AnyMock = Record<string, jest.Mock>;

function redisLockOk(): AnyMock {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
}

describe('QC FEATURE-085 — workers', () => {
  describe('submit-worker (BR-IGL-10)', () => {
    const doc = {
      _id: '1',
      athletesId: 101,
      payloadSnapshot: { partnerRefId: 'igloo:101:220' },
    };

    it('POST thành công → markSubmitted(iglooRequestId)', async () => {
      const redis = redisLockOk();
      const http = {
        createRequest: jest.fn().mockResolvedValue({ iglooRequestId: 'IGL-1' }),
      };
      const req = {
        getQueuedToSubmit: jest.fn().mockResolvedValue([doc]),
        markSubmitted: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const worker = new IglooSubmitWorkerCron(
        redis as never,
        http as never,
        req as never,
      );
      await worker.tick();
      expect(http.createRequest).toHaveBeenCalledWith(doc.payloadSnapshot);
      expect(req.markSubmitted).toHaveBeenCalledWith('1', 'IGL-1');
      expect(req.markFailed).not.toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // lock released
    });

    it('POST lỗi → markFailed(message), KHÔNG silent', async () => {
      const redis = redisLockOk();
      const http = {
        createRequest: jest.fn().mockRejectedValue(new Error('GIC 500')),
      };
      const req = {
        getQueuedToSubmit: jest.fn().mockResolvedValue([doc]),
        markSubmitted: jest.fn(),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const worker = new IglooSubmitWorkerCron(
        redis as never,
        http as never,
        req as never,
      );
      await worker.tick();
      expect(req.markFailed).toHaveBeenCalledWith('1', 'GIC 500');
      expect(req.markSubmitted).not.toHaveBeenCalled();
    });

    it('lock đang giữ (SETNX != OK) → KHÔNG xử lý', async () => {
      const redis = { set: jest.fn().mockResolvedValue(null), del: jest.fn() };
      const http = { createRequest: jest.fn() };
      const req = { getQueuedToSubmit: jest.fn() };
      const worker = new IglooSubmitWorkerCron(
        redis as never,
        http as never,
        req as never,
      );
      await worker.tick();
      expect(req.getQueuedToSubmit).not.toHaveBeenCalled();
      expect(http.createRequest).not.toHaveBeenCalled();
    });
  });

  describe('poll-worker (BR-IGL-10)', () => {
    it('SUCCESS → applyStatus lưu contractNo + certificateUrl', async () => {
      const redis = redisLockOk();
      const http = {
        getStatus: jest.fn().mockResolvedValue({
          status: 'SUCCESS',
          gicContractNo: 'IGL/GTDAPI/260411/001',
          certificateUrl: 'https://gic/cert.pdf',
        }),
      };
      const req = {
        getToPoll: jest
          .fn()
          .mockResolvedValue([{ _id: '2', iglooRequestId: 'IGL-2' }]),
        applyStatus: jest.fn().mockResolvedValue(undefined),
      };
      const worker = new IglooPollWorkerCron(
        redis as never,
        http as never,
        req as never,
      );
      await worker.tick();
      expect(req.applyStatus).toHaveBeenCalledWith(
        '2',
        'SUCCESS',
        'IGL/GTDAPI/260411/001',
        'https://gic/cert.pdf',
      );
    });

    it('status lạ → map về PROCESSING (không crash)', async () => {
      const redis = redisLockOk();
      const http = {
        getStatus: jest
          .fn()
          .mockResolvedValue({ status: 'WEIRD', gicContractNo: null, certificateUrl: null }),
      };
      const req = {
        getToPoll: jest
          .fn()
          .mockResolvedValue([{ _id: '3', iglooRequestId: 'IGL-3' }]),
        applyStatus: jest.fn().mockResolvedValue(undefined),
      };
      const worker = new IglooPollWorkerCron(
        redis as never,
        http as never,
        req as never,
      );
      await worker.tick();
      expect(req.applyStatus).toHaveBeenCalledWith('3', 'PROCESSING', null, null);
    });
  });

  describe('kill-switch gating (source assertion)', () => {
    it('submit-worker có guard IGLOO_SUBMIT_ENABLED', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../crons/igloo-submit-worker.cron.ts'),
        'utf8',
      );
      expect(src).toMatch(/if\s*\(!env\.igloo\.submitEnabled\)\s*return/);
    });
    it('daily-cron có guard IGLOO_DAILY_ENABLED', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../crons/igloo-daily.cron.ts'),
        'utf8',
      );
      expect(src).toMatch(/if\s*\(!env\.igloo\.dailyEnabled\)/);
    });
  });
});
