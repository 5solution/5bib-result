import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { CertificatesModule } from '../certificates/certificates.module';
import {
  CrewCertBatch,
  CrewCertBatchSchema,
} from './schemas/crew-cert-batch.schema';
import {
  CrewCertRecipient,
  CrewCertRecipientSchema,
} from './schemas/crew-cert-recipient.schema';
import { CrewCertificatesController } from './crew-certificates.controller';
import { CrewCertificatesService } from './crew-certificates.service';

/**
 * FEATURE-090 — Crew Certificate (GCN). Reuse CertificateRenderService từ
 * CertificatesModule (exports sẵn). Pure Mongo + Redis + render engine.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CrewCertBatch.name, schema: CrewCertBatchSchema },
      { name: CrewCertRecipient.name, schema: CrewCertRecipientSchema },
    ]),
    CertificatesModule,
    LogtoAuthModule,
  ],
  controllers: [CrewCertificatesController],
  providers: [CrewCertificatesService],
  exports: [CrewCertificatesService],
})
export class CrewCertificatesModule {}
