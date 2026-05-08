import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from 'src/config';
import {
  ResultKioskDisplay,
  ResultKioskDisplaySchema,
} from './schemas/result-kiosk-display.schema';
import { ResultKioskDisplayService } from './services/result-kiosk-display.service';
import { ResultKioskDisplayController } from './result-kiosk-display.controller';
import { LogtoAuthModule } from '../logto-auth';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ResultKioskDisplay.name, schema: ResultKioskDisplaySchema },
    ]),
    LogtoAuthModule,
  ],
  controllers: [ResultKioskDisplayController],
  providers: [
    ResultKioskDisplayService,
    {
      provide: S3Client,
      useFactory: () =>
        new S3Client({
          region: env.s3.region,
          credentials: {
            accessKeyId: env.s3.accessKeyId,
            secretAccessKey: env.s3.secretAccessKey,
          },
        }),
    },
  ],
  exports: [ResultKioskDisplayService],
})
export class ResultKioskDisplayModule {}
