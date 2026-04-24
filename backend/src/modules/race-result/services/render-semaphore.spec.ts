import { ServiceUnavailableException } from '@nestjs/common';
import { RenderSemaphore } from './render-semaphore';

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

describe('RenderSemaphore', () => {
  const origEnvMax = process.env.RENDER_MAX_CONCURRENT;
  const origEnvQueue = process.env.RENDER_MAX_QUEUE;

  afterEach(() => {
    // Restore env vars after each test so other suites are unaffected
    if (origEnvMax === undefined) delete process.env.RENDER_MAX_CONCURRENT;
    else process.env.RENDER_MAX_CONCURRENT = origEnvMax;
    if (origEnvQueue === undefined) delete process.env.RENDER_MAX_QUEUE;
    else process.env.RENDER_MAX_QUEUE = origEnvQueue;
  });

  describe('constructor', () => {
    it('honors RENDER_MAX_CONCURRENT env override', () => {
      process.env.RENDER_MAX_CONCURRENT = '3';
      process.env.RENDER_MAX_QUEUE = '7';
      const sem = new RenderSemaphore();
      const m = sem.getMetrics();
      expect(m.maxConcurrent).toBe(3);
      expect(m.maxQueueDepth).toBe(7);
    });

    it('falls back to default when env is invalid', () => {
      process.env.RENDER_MAX_CONCURRENT = 'not-a-number';
      process.env.RENDER_MAX_QUEUE = '0';
      const sem = new RenderSemaphore();
      const m = sem.getMetrics();
      expect(m.maxConcurrent).toBeGreaterThanOrEqual(4);
      expect(m.maxConcurrent).toBeLessThanOrEqual(16);
      expect(m.maxQueueDepth).toBe(200);
    });
  });

  describe('concurrency cap', () => {
    it('caps running tasks at maxConcurrent', async () => {
      process.env.RENDER_MAX_CONCURRENT = '2';
      process.env.RENDER_MAX_QUEUE = '10';
      const sem = new RenderSemaphore();

      let concurrent = 0;
      let peak = 0;
      const task = async () => {
        concurrent++;
        peak = Math.max(peak, concurrent);
        await sleep(20);
        concurrent--;
      };

      await Promise.all([sem.run(task), sem.run(task), sem.run(task), sem.run(task)]);

      expect(peak).toBe(2); // never exceeded cap
    });
  });

  describe('queue → release FIFO', () => {
    it('releases queued waiters in FIFO order', async () => {
      process.env.RENDER_MAX_CONCURRENT = '1';
      process.env.RENDER_MAX_QUEUE = '10';
      const sem = new RenderSemaphore();

      const order: number[] = [];
      const gated: Promise<void>[] = [];
      for (let i = 0; i < 5; i++) {
        gated.push(
          sem.run(async () => {
            order.push(i);
            await sleep(5);
          }),
        );
      }
      await Promise.all(gated);
      expect(order).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('503 rejection when queue full', () => {
    it('rejects with ServiceUnavailableException past maxQueueDepth', async () => {
      process.env.RENDER_MAX_CONCURRENT = '1';
      process.env.RENDER_MAX_QUEUE = '2';
      const sem = new RenderSemaphore();

      const block = sem.run(async () => {
        await sleep(50);
      });
      // 2 queued (fills queue at depth 2)
      const q1 = sem.run(async () => { /* no-op */ });
      const q2 = sem.run(async () => { /* no-op */ });

      // 3rd waiter should be rejected immediately
      await expect(
        sem.run(async () => { /* no-op */ }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      await Promise.all([block, q1, q2]);

      const m = sem.getMetrics();
      expect(m.totalRejected).toBe(1);
    });

    it('503 body includes retryAfterSeconds hint', async () => {
      process.env.RENDER_MAX_CONCURRENT = '1';
      process.env.RENDER_MAX_QUEUE = '1';
      const sem = new RenderSemaphore();

      const blocking = sem.run(async () => {
        await sleep(30);
      });
      const filler = sem.run(async () => { /* queued */ });

      try {
        await sem.run(async () => {});
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const response = (err as ServiceUnavailableException).getResponse() as {
          retryAfterSeconds: number;
        };
        expect(response.retryAfterSeconds).toBe(10);
      }

      await Promise.all([blocking, filler]);
    });
  });

  describe('metrics', () => {
    it('increments totalAcquired on successful run', async () => {
      process.env.RENDER_MAX_CONCURRENT = '4';
      const sem = new RenderSemaphore();
      await sem.run(async () => {});
      await sem.run(async () => {});
      expect(sem.getMetrics().totalAcquired).toBe(2);
    });

    it('tracks peakQueueDepth', async () => {
      process.env.RENDER_MAX_CONCURRENT = '1';
      process.env.RENDER_MAX_QUEUE = '10';
      const sem = new RenderSemaphore();

      const blockingTask = sem.run(async () => {
        await sleep(30);
      });
      const queued = [
        sem.run(async () => {}),
        sem.run(async () => {}),
        sem.run(async () => {}),
      ];
      // Give event loop a tick so queue fills
      await sleep(5);
      const peakBeforeDrain = sem.getMetrics().peakQueueDepth;
      expect(peakBeforeDrain).toBeGreaterThanOrEqual(3);

      await Promise.all([blockingTask, ...queued]);
    });
  });

  describe('release on error', () => {
    it('releases slot even if fn throws', async () => {
      process.env.RENDER_MAX_CONCURRENT = '1';
      const sem = new RenderSemaphore();

      await expect(
        sem.run(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      // Should be able to run next task
      let ran = false;
      await sem.run(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });
  });
});
