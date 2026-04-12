import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { NotificationModule } from './notification/notification.module';
import { MerchantModule } from './merchant/merchant.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { Tenant } from './merchant/entities/tenant.entity';

// Conditional: chỉ khởi tạo Platform DB nếu PLATFORM_DB_HOST được cung cấp
const platformDbModules = env.platformDb.host
  ? [
      TypeOrmModule.forRoot({
        name: 'platform',
        type: 'mysql',
        host: env.platformDb.host,
        port: env.platformDb.port,
        username: env.platformDb.user,
        password: env.platformDb.pass,
        database: env.platformDb.name,
        entities: [Tenant],
        synchronize: false, // KHÔNG auto-sync — DB là readonly
        logging: env.env === 'local' || env.env === 'development',
        extra: {
          connectionLimit: 5,
        },
      }),
      MerchantModule,
      ReconciliationModule,
    ]
  : [];

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
    ...platformDbModules,
    RacesModule,
    RaceResultModule,
    AdminModule,
    AuthModule,
    UploadModule,
    SponsorsModule,
    NotificationModule,
  ],
})
export class AppModule {}
