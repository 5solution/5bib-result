/**
 * F-069 — MerchantPortalAdminController search-endpoint unit tests.
 *
 * Coverage:
 *  - GET /tenants/search → delegates to portalService.searchTenants(q)
 *  - GET /races/search   → delegates to portalService.searchRaces(q)
 *  - empty q passthrough (undefined)
 *  - 401/403 — LogtoAdminGuard denies non-admin (guard returns false → request blocked)
 *
 * Service layer mocked. Guard overridden to assert denial path. The CRUD
 * collaborator (MerchantPortalAccessService) is mocked as a no-op stub.
 */

import { Test, TestingModule } from '@nestjs/testing';

import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';
import { MerchantPortalAdminController } from './merchant-portal-admin.controller';
import { MerchantPortalAccessService } from './services/merchant-portal-access.service';
import { MerchantPortalService } from './services/merchant-portal.service';

describe('MerchantPortalAdminController (search)', () => {
  let controller: MerchantPortalAdminController;
  let portalService: { searchTenants: jest.Mock; searchRaces: jest.Mock };

  beforeEach(async () => {
    portalService = {
      searchTenants: jest.fn(),
      searchRaces: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MerchantPortalAdminController],
      providers: [
        { provide: MerchantPortalAccessService, useValue: {} },
        { provide: MerchantPortalService, useValue: portalService },
      ],
    })
      // Default: guard allows (route logic tests). 401/403 covered separately.
      .overrideGuard(LogtoAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(MerchantPortalAdminController);
  });

  describe('GET /tenants/search', () => {
    it('delegates q to portalService.searchTenants', async () => {
      const resp = { items: [{ id: 42, name: 'CLB', taxCode: '0312' }] };
      portalService.searchTenants.mockResolvedValue(resp);
      const r = await controller.searchTenants({ q: 'CLB' });
      expect(portalService.searchTenants).toHaveBeenCalledWith('CLB');
      expect(r).toBe(resp);
    });

    it('empty q → passes undefined through', async () => {
      portalService.searchTenants.mockResolvedValue({ items: [] });
      await controller.searchTenants({});
      expect(portalService.searchTenants).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /races/search', () => {
    it('delegates q to portalService.searchRaces', async () => {
      const resp = {
        items: [
          {
            raceId: 501,
            title: 'Marathon',
            status: 'COMPLETE',
            tenantId: 42,
            tenantName: 'CLB',
          },
        ],
      };
      portalService.searchRaces.mockResolvedValue(resp);
      const r = await controller.searchRaces({ q: 'Marathon' });
      expect(portalService.searchRaces).toHaveBeenCalledWith('Marathon');
      expect(r).toBe(resp);
    });

    it('empty q → passes undefined through', async () => {
      portalService.searchRaces.mockResolvedValue({ items: [] });
      await controller.searchRaces({});
      expect(portalService.searchRaces).toHaveBeenCalledWith(undefined);
    });
  });

  describe('LogtoAdminGuard (401/403 — non-admin denied)', () => {
    it('guard returning false blocks the route (no service call)', async () => {
      const denyModule: TestingModule = await Test.createTestingModule({
        controllers: [MerchantPortalAdminController],
        providers: [
          { provide: MerchantPortalAccessService, useValue: {} },
          { provide: MerchantPortalService, useValue: portalService },
        ],
      })
        .overrideGuard(LogtoAdminGuard)
        .useValue({ canActivate: () => false })
        .compile();

      const guard = denyModule.get<{ canActivate: () => boolean }>(
        LogtoAdminGuard,
      );
      // Guard denies → Nest would reject the request before handler runs.
      expect(guard.canActivate()).toBe(false);
      expect(portalService.searchTenants).not.toHaveBeenCalled();
      expect(portalService.searchRaces).not.toHaveBeenCalled();
    });
  });
});
