import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

import {
  CertificateTemplate,
  CertificateTemplateSchema,
} from './schemas/certificate-template.schema';
import {
  RaceCertificateConfig,
  RaceCertificateConfigSchema,
} from './schemas/race-certificate-config.schema';

import { CertificateTemplateService } from './services/certificate-template.service';
import { RaceCertificateConfigService } from './services/race-certificate-config.service';
import { CertificateRenderService } from './services/certificate-render.service';
import { CertificatesController } from './certificates.controller';

import { RaceResultModule } from '../race-result/race-result.module';
import { RacesModule } from '../races/races.module';
import { LogtoAuthModule } from '../logto-auth';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CertificateTemplate.name, schema: CertificateTemplateSchema },
      {
        name: RaceCertificateConfig.name,
        schema: RaceCertificateConfigSchema,
      },
    ]),
    // Module-scoped throttler (mirrors TeamManagement pattern) so @Throttle()
    // decorators apply without interfering with the app-wide setup.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    RaceResultModule,
    RacesModule,
    LogtoAuthModule,
  ],
  controllers: [CertificatesController],
  providers: [
    CertificateTemplateService,
    RaceCertificateConfigService,
    CertificateRenderService,
  ],
  exports: [
    CertificateTemplateService,
    RaceCertificateConfigService,
    CertificateRenderService,
  ],
})
export class CertificatesModule {}
