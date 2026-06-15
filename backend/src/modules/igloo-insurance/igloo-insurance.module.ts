import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { IglooInsuranceController } from './igloo-insurance.controller';
import {
  IglooInsuranceRequest,
  IglooInsuranceRequestSchema,
} from './schemas/igloo-insurance-request.schema';
import { IglooHttpService } from './services/igloo-http.service';
import { IglooSelectionService } from './services/igloo-selection.service';
import { IglooRequestService } from './services/igloo-request.service';
import { IglooDailyCron } from './crons/igloo-daily.cron';
import { IglooSubmitWorkerCron } from './crons/igloo-submit-worker.cron';
import { IglooPollWorkerCron } from './crons/igloo-poll-worker.cron';

/**
 * FEATURE-085 — IglooInsuranceModule.
 *
 * ĐĂNG KÝ TRONG `platformDbModules` (app.module) — chỉ load khi PLATFORM_DB_*
 * có (IglooSelectionService inject DataSource 'platform'). `@InjectDataSource`
 * resolve global từ TypeOrmModule.forRoot('platform').
 *
 * 2 kill-switch ENV (IGLOO_DAILY_ENABLED + IGLOO_SUBMIT_ENABLED) default false
 * → dev KHÔNG bao giờ phát sinh đơn thật.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: IglooInsuranceRequest.name,
        schema: IglooInsuranceRequestSchema,
      },
    ]),
    HttpModule,
    LogtoAuthModule,
  ],
  controllers: [IglooInsuranceController],
  providers: [
    IglooHttpService,
    IglooSelectionService,
    IglooRequestService,
    IglooDailyCron,
    IglooSubmitWorkerCron,
    IglooPollWorkerCron,
  ],
})
export class IglooInsuranceModule {}
