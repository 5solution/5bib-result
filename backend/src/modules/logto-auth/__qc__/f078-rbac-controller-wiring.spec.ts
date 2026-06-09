/**
 * F-078 QC adversarial structural test — verify mỗi trong 13 controller
 * thực sự đính `@UseGuards()` đúng guard class qua Nest reflection metadata.
 *
 * Rationale: PRD BR-78-23 + BR-78-24 chốt 13 controller PHẢI đổi guard. Coder
 * dùng sed batch rename — adversarial test này phòng:
 *   1. Future regression: dev khác accidentally revert 1 controller về
 *      LogtoAdminGuard/LogtoStaffGuard mà CI không catch.
 *   2. Coder typo: import LogtoFinanceGuard nhưng decorator vẫn cũ
 *      (Edit mismatch — chuyện đã xảy ra với F-040 hand-edit cascade).
 *
 * Đây là structural test (Reflect.getMetadata) chứ không phải runtime HTTP test
 * — fast (<1s) + đủ chặt để gate CI catch regression.
 *
 * Manager Plan Scope Lock đã chốt 13 controller. Nếu test này fail = scope drift.
 */
import 'reflect-metadata';
import { PnLController } from '../../finance/controllers/pnl.controller';
import { PnLDashboardController } from '../../finance/controllers/pnl-dashboard.controller';
import { PnLContractsListController } from '../../finance/controllers/pnl-contracts-list.controller';
import { PnLExportController } from '../../finance/controllers/pnl-export.controller';
import { CostItemsController } from '../../finance/controllers/cost-items.controller';
import { CostSuggestionsController } from '../../finance/controllers/cost-suggestions.controller';
import { FeeBreakdownController } from '../../finance/controllers/fee-breakdown.controller';
import { MysqlLookupController } from '../../finance/controllers/mysql-lookup.controller';
import { InvoiceReconcileController } from '../../invoice-reconcile/invoice-reconcile.controller';
import { ContractsController } from '../../contracts/contracts.controller';
import { ContractTemplatesController } from '../../contracts/contract-templates.controller';
import { PartnersController } from '../../contracts/partners.controller';
import { ServiceCatalogController } from '../../contracts/service-catalog.controller';
import { LogtoFinanceGuard } from '../logto-finance.guard';
import { LogtoStaffOrFinanceGuard } from '../logto-staff-or-finance.guard';
import { LogtoAdminGuard } from '../logto-admin.guard';
import { LogtoStaffGuard } from '../logto-staff.guard';

/**
 * Helper — extract class-level @UseGuards metadata.
 * Nest stores guards array under '__guards__' key on the constructor.
 */
function getClassGuards(controllerClass: object): unknown[] {
  return (Reflect.getMetadata('__guards__', controllerClass) ?? []) as unknown[];
}

describe('F-078 — RBAC Controller Wiring (structural assertion)', () => {
  describe('Nhóm 1: 9 controller → LogtoFinanceGuard (BR-78-23)', () => {
    const financeControllers = [
      { name: 'PnLController', cls: PnLController },
      { name: 'PnLDashboardController', cls: PnLDashboardController },
      { name: 'PnLContractsListController', cls: PnLContractsListController },
      { name: 'PnLExportController', cls: PnLExportController },
      { name: 'CostItemsController', cls: CostItemsController },
      { name: 'CostSuggestionsController', cls: CostSuggestionsController },
      { name: 'FeeBreakdownController', cls: FeeBreakdownController },
      { name: 'MysqlLookupController', cls: MysqlLookupController },
      { name: 'InvoiceReconcileController', cls: InvoiceReconcileController },
    ];

    it.each(financeControllers)(
      '$name has LogtoFinanceGuard class-level decorator',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        expect(guards).toContain(LogtoFinanceGuard);
      },
    );

    it.each(financeControllers)(
      '$name does NOT have LogtoAdminGuard (BR-78-23 widen từ admin-only)',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        expect(guards).not.toContain(LogtoAdminGuard);
      },
    );

    it.each(financeControllers)(
      '$name does NOT have LogtoStaffGuard (finance ≠ staff tier)',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        expect(guards).not.toContain(LogtoStaffGuard);
      },
    );
  });

  describe('Nhóm 2: 4 controller → LogtoStaffOrFinanceGuard (BR-78-24 loosened policy)', () => {
    const contractControllers = [
      { name: 'ContractsController', cls: ContractsController },
      { name: 'ContractTemplatesController', cls: ContractTemplatesController },
      { name: 'PartnersController', cls: PartnersController },
      { name: 'ServiceCatalogController', cls: ServiceCatalogController },
    ];

    it.each(contractControllers)(
      '$name has LogtoStaffOrFinanceGuard class-level decorator',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        expect(guards).toContain(LogtoStaffOrFinanceGuard);
      },
    );

    it.each(contractControllers)(
      '$name does NOT have LogtoStaffGuard alone (PAUSE-78-01 loosened)',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        expect(guards).not.toContain(LogtoStaffGuard);
      },
    );

    it.each(contractControllers)(
      '$name does NOT have LogtoAdminGuard (regression check)',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        expect(guards).not.toContain(LogtoAdminGuard);
      },
    );

    it.each(contractControllers)(
      '$name does NOT have LogtoFinanceGuard alone (would break staff Tâm/Hằng)',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        // Must use the union guard, NOT the strict-finance guard
        expect(guards).not.toContain(LogtoFinanceGuard);
      },
    );
  });

  describe('Total count assertion — 13 controller', () => {
    it('exactly 13 controller in F-078 Scope Lock (BR-78-25)', () => {
      const allControllers = [
        PnLController,
        PnLDashboardController,
        PnLContractsListController,
        PnLExportController,
        CostItemsController,
        CostSuggestionsController,
        FeeBreakdownController,
        MysqlLookupController,
        InvoiceReconcileController,
        ContractsController,
        ContractTemplatesController,
        PartnersController,
        ServiceCatalogController,
      ];
      expect(allControllers).toHaveLength(13);

      // Verify mỗi controller có ít nhất 1 guard (zero unguarded leak)
      for (const cls of allControllers) {
        const guards = getClassGuards(cls);
        expect(guards.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
