import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule } from '@nestjs/config';
import { env } from 'src/config';
import { RacesModule } from './races/races.module';
import { RaceResultModule } from './race-result/race-result.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { SponsorsModule } from './sponsors/sponsors.module';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongodb.url, { dbName: env.mongodb.dbName }),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    RedisModule.forRoot({
      type: 'single',
      url: env.redisUrl,
      options: {},
    }),
    RacesModule,
    RaceResultModule,
    AdminModule,
    AuthModule,
    UploadModule,
    SponsorsModule,
  ],
})
export class AppModule {}
