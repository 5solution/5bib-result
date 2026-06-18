import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { CertificatesModule } from '../certificates/certificates.module';
import {
  BibPassConfig,
  BibPassConfigSchema,
} from './schemas/bib-pass-config.schema';
import { BibPassSend, BibPassSendSchema } from './schemas/bib-pass-send.schema';
import { BibPassEmailController } from './bib-pass-email.controller';
import { BibPassConfigService } from './bib-pass-config.service';
import { BibPassSenderService } from './bib-pass-sender.service';
import { BibPassScannerService } from './bib-pass-scanner.service';
import { BibPassScanCron } from './crons/bib-pass-scan.cron';

/**
 * FEATURE-091 — Border Pass email.
 *
 * ĐĂNG KÝ TRONG `platformDbModules` (app.module) — BibPassScannerService inject
 * `DataSource('platform')` → chỉ load khi PLATFORM_DB_* có (cùng nhóm
 * IglooInsuranceModule / RaceMasterDataModule).
 *
 * Reuse: CertificateRenderService (CertificatesModule exports) cho render +
 * FONT_OPTIONS; MailService (NotificationModule @Global) cho egress. Mongo riêng
 * (bib_pass_configs + bib_pass_sends). Kill-switch BIB_PASS_SEND_ENABLED default
 * false → dev/staging KHÔNG egress email thật.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BibPassConfig.name, schema: BibPassConfigSchema },
      { name: BibPassSend.name, schema: BibPassSendSchema },
    ]),
    CertificatesModule,
    LogtoAuthModule,
  ],
  controllers: [BibPassEmailController],
  providers: [
    BibPassConfigService,
    BibPassSenderService,
    BibPassScannerService,
    BibPassScanCron,
  ],
  exports: [BibPassConfigService, BibPassSenderService],
})
export class BibPassEmailModule {}
