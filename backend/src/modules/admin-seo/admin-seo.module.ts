import { Module } from '@nestjs/common';
import { RacesModule } from '../races/races.module';
import { LogtoAuthModule } from '../logto-auth';
import { AdminSeoController } from './admin-seo.controller';

/**
 * FEATURE-036 — Admin SEO module.
 *
 * Re-exports nothing — just wires controller against SeoSlugSyncService
 * which lives in RacesModule. RacesModule must export the service.
 */
@Module({
  imports: [RacesModule, LogtoAuthModule],
  controllers: [AdminSeoController],
})
export class AdminSeoModule {}
