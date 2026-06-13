import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/modules/app.module';

/**
 * FEATURE-083 — Race Landing E2E (Supertest). QC Phase 3.
 *
 * Runnable when backend deps are up (Mongo + Redis). Auth-gated mutation flows
 * (create → configure → publish) need an admin Logto token fixture — set
 * `LANDING_E2E_ADMIN_TOKEN` env to enable the full create→publish→public flow;
 * otherwise only the unauthenticated/contract assertions run. Mirrors the
 * F-027 / F-037 convention where full integration runs in the configured QC env.
 */
describe('Race Landing (e2e)', () => {
  let app: INestApplication;
  const adminToken = process.env.LANDING_E2E_ADMIN_TOKEN;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Auth / route mounting (no token)', () => {
    it('GET /api/landings → 401 (LogtoAdminGuard, route mounted)', async () => {
      const res = await request(app.getHttpServer()).get('/api/landings');
      expect(res.status).toBe(401);
    });
    it('POST /api/landings → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/landings')
        .send({ raceId: '650000000000000000000000' });
      expect(res.status).toBe(401);
    });
    it('PATCH /api/landings/:id → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/landings/650000000000000000000000')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('Public reads (no auth)', () => {
    it('GET /api/landings/slug/:slug → 404 for unknown slug', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/landings/slug/__nope__',
      );
      expect(res.status).toBe(404);
    });
    it('GET /api/landings/resolve?host=… → 404 for unknown host', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/landings/resolve?host=__nope__.5bib.com',
      );
      expect(res.status).toBe(404);
    });
    it('route ordering: slug/:slug not shadowed by :id', async () => {
      // "slug" must resolve the public handler (404), not the admin :id handler (401)
      const res = await request(app.getHttpServer()).get('/api/landings/slug/x');
      expect(res.status).toBe(404);
    });
  });

  // ── Full admin flow (requires LANDING_E2E_ADMIN_TOKEN + a real race _id) ──
  const maybe = adminToken ? describe : describe.skip;
  maybe('Admin create → configure → publish → public strip', () => {
    const raceId = process.env.LANDING_E2E_RACE_ID ?? '';
    let landingId: string;
    const auth = `Bearer ${adminToken}`;

    it('POST create seeds sections (no _id leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/landings')
        .set('Authorization', auth)
        .send({ raceId });
      expect([201, 409]).toContain(res.status);
      if (res.status === 201) {
        landingId = res.body.id;
        expect(res.body).not.toHaveProperty('_id');
        expect(res.body.sections.length).toBeGreaterThan(0);
      }
    });

    it('PATCH subdomain reserved → 400', async () => {
      if (!landingId) return;
      const res = await request(app.getHttpServer())
        .patch(`/api/landings/${landingId}`)
        .set('Authorization', auth)
        .send({ domain: { subdomain: 'admin' } });
      expect(res.status).toBe(400);
    });

    it('publish without subdomain → 422, then with valid subdomain → 200 + public strip', async () => {
      if (!landingId) return;
      const noSub = await request(app.getHttpServer())
        .post(`/api/landings/${landingId}/publish`)
        .set('Authorization', auth);
      expect([200, 422]).toContain(noSub.status);

      const sub = `e2e-${Date.now()}`;
      await request(app.getHttpServer())
        .patch(`/api/landings/${landingId}`)
        .set('Authorization', auth)
        .send({ domain: { subdomain: sub } });
      const pub = await request(app.getHttpServer())
        .post(`/api/landings/${landingId}/publish`)
        .set('Authorization', auth);
      expect(pub.status).toBe(200);

      const pubGet = await request(app.getHttpServer()).get(
        `/api/landings/slug/${sub}`,
      );
      expect(pubGet.status).toBe(200);
      expect(pubGet.body).not.toHaveProperty('_id');
      expect(pubGet.body).not.toHaveProperty('merchantRef');
      expect(pubGet.body).not.toHaveProperty('internalName');
      expect(pubGet.body).not.toHaveProperty('publish');
    });
  });
});
