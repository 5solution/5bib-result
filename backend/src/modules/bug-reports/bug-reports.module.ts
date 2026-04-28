import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BugReport, BugReportSchema } from './schemas/bug-report.schema';
import { BugReportsService } from './bug-reports.service';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsAdminController } from './bug-reports-admin.controller';
import { LogtoAuthModule } from '../logto-auth/logto-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BugReport.name, schema: BugReportSchema }]),
    LogtoAuthModule,
  ],
  controllers: [BugReportsController, BugReportsAdminController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
