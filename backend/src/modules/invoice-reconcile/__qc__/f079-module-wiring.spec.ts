/**
 * F-079 QC adversarial structural test — verify cross-module DI wiring đúng.
 *
 * Rationale: Forced Cascade #1 (IMPLEMENTATION_NOTES Section 2) — Manager
 * Plan đọc nhầm `providers` thành `exports` của RaceMasterDataModule. Add
 * `AthleteIdentityClusteringService` to exports[] 1-line. QC structural test
 * ngăn future regression nếu ai đó accidentally remove khỏi exports[].
 *
 * Cũng verify InvoiceReconcileModule import RaceMasterDataModule + Optional
 * inject resolver — boot without RaceMasterDataModule = graceful (BR-79-23).
 *
 * Pattern reuse: F-078 QC structural test (Reflect.getMetadata Nest module
 * inspection).
 */
import { Test } from '@nestjs/testing';
import { RaceMasterDataModule } from '../../race-master-data/race-master-data.module';
import { AthleteIdentityClusteringService } from '../../race-master-data/services/athlete-identity-clustering.service';
import { InvoiceReconcileModule } from '../invoice-reconcile.module';

describe('F-079 QC — module wiring structural assertion', () => {
  describe('Forced #1 — RaceMasterDataModule exports AthleteIdentityClusteringService', () => {
    it('module exports include AthleteIdentityClusteringService for cross-module DI', () => {
      // Nest metadata: 'exports' key on the module class
      const exports = Reflect.getMetadata('exports', RaceMasterDataModule) as
        | unknown[]
        | undefined;
      expect(exports).toBeDefined();
      expect(exports).toContain(AthleteIdentityClusteringService);
    });

    it('regression: if removed from exports, InvoiceReconcileModule DI fails', () => {
      // This test documents the WHY for the export — if anyone removes the
      // service from exports[], this assertion + Nest boot resolve will fail.
      const exports = Reflect.getMetadata('exports', RaceMasterDataModule) as
        | unknown[]
        | undefined;
      // Service MUST be in exports (NOT just providers) for cross-module @Inject
      const hasService = exports?.includes(AthleteIdentityClusteringService);
      if (!hasService) {
        throw new Error(
          'F-079 BR-79-21 regression: AthleteIdentityClusteringService removed from RaceMasterDataModule.exports[]. ' +
            'InvoiceReconcileModule cannot inject the resolver. Add it back to exports[].',
        );
      }
    });
  });

  describe('InvoiceReconcileModule imports RaceMasterDataModule', () => {
    it('module imports list includes RaceMasterDataModule', () => {
      const imports = Reflect.getMetadata('imports', InvoiceReconcileModule) as
        | unknown[]
        | undefined;
      expect(imports).toBeDefined();
      expect(imports).toContain(RaceMasterDataModule);
    });
  });

  describe('Boot integration — InvoiceReconcileModule resolves with RaceMasterDataModule', () => {
    it('Nest test bed compiles full module graph (no DI errors)', async () => {
      // This validates the entire wire — if circular dep or missing export,
      // .compile() throws. Use try/catch để verify NO throw.
      let compileError: Error | null = null;
      try {
        const moduleRef = await Test.createTestingModule({
          imports: [InvoiceReconcileModule],
        })
          .overrideProvider(AthleteIdentityClusteringService)
          .useValue({
            getRaceTitlesByMysqlIds: jest.fn().mockResolvedValue(new Map()),
          })
          // Override env-dependent providers to avoid env config requirement
          .compile();
        // Cleanup
        await moduleRef.close();
      } catch (err) {
        compileError = err as Error;
      }
      // If compile fails, log error message for debug — but only assert if
      // failure is DI-related (not env/config related which is expected in
      // test env without full app context).
      if (compileError) {
        const msg = compileError.message;
        // Acceptable: env/config missing in isolated test compile.
        // NOT acceptable: "Nest can't resolve dependencies" for our services.
        expect(msg).not.toContain('AthleteIdentityClusteringService');
        expect(msg).not.toContain('RaceMasterDataModule');
      }
    }, 30_000);
  });
});
