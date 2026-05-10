import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { AuditLogService } from './services/audit-log.service';

/**
 * F-023 — Audit Log infrastructure.
 *
 * Cung cấp `AuditLogService` để các module khác inject (qua import AuditModule)
 * và emit audit event sau mutation. Cô lập sang module riêng (KHÔNG nhúng vào
 * dashboard) vì audit là cross-cutting concern + DashboardModule chỉ ĐỌC,
 * còn các module ghi (races/claims/recon/awards/medical) cần ghi audit.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [AuditLogService],
  exports: [AuditLogService, MongooseModule],
})
export class AuditModule {}
