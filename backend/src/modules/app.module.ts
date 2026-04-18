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
import { HomepageModule } from './homepage/homepage.module';
import { SearchModule } from './search/search.module';
import { MerchantModule } from './merchant/merchant.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { Tenant } from './merchant/entities/tenant.entity';
import { TeamManagementModule } from './team-management/team-management.module';
import { VolEvent } from './team-management/entities/vol-event.entity';
import { VolRole } from './team-management/entities/vol-role.entity';
import { VolRegistration } from './team-management/entities/vol-registration.entity';
import { VolContractTemplate } from './team-management/entities/vol-contract-template.entity';
import { VolShirtStock } from './team-management/entities/vol-shirt-stock.entity';
import { VolTeamScheduleEmail } from './team-management/entities/vol-team-schedule-email.entity';
import { VolEventContact } from './team-management/entities/vol-event-contact.entity';
import { VolStation } from './team-management/entities/vol-station.entity';
import { VolStationAssignment } from './team-management/entities/vol-station-assignment.entity';
import { VolSupplyItem } from './team-management/entities/vol-supply-item.entity';
import { VolSupplyPlan } from './team-management/entities/vol-supply-plan.entity';
import { VolSupplyAllocation } from './team-management/entities/vol-supply-allocation.entity';
import { VolSupplySupplement } from './team-management/entities/vol-supply-supplement.entity';

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
      AnalyticsModule,
    ]
  : [];

// Conditional: chỉ khởi tạo Volunteer DB + Team Management module nếu VOLUNTEER_DB_HOST được cung cấp
const volunteerDbModules = env.volunteerDb.host
  ? [
      TypeOrmModule.forRoot({
        name: 'volunteer',
        type: 'mysql',
        host: env.volunteerDb.host,
        port: env.volunteerDb.port,
        username: env.volunteerDb.user,
        password: env.volunteerDb.pass,
        database: env.volunteerDb.name,
        entities: [
          VolEvent,
          VolRole,
          VolRegistration,
          VolContractTemplate,
          VolShirtStock,
          VolTeamScheduleEmail,
          VolEventContact,
          VolStation,
          VolStationAssignment,
          VolSupplyItem,
          VolSupplyPlan,
          VolSupplyAllocation,
          VolSupplySupplement,
        ],
        synchronize: false,
        logging: env.env === 'local' || env.env === 'development',
        extra: {
          connectionLimit: 10,
        },
      }),
      TeamManagementModule,
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
    ...volunteerDbModules,
    RacesModule,
    RaceResultModule,
    AdminModule,
    AuthModule,
    UploadModule,
    SponsorsModule,
    NotificationModule,
    HomepageModule,
    SearchModule,
  ],
})
export class AppModule {}
