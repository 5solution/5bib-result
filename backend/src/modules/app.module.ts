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
import { LogtoAuthModule } from './logto-auth';
import { UploadModule } from './upload/upload.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { NotificationModule } from './notification/notification.module';
import { HomepageModule } from './homepage/homepage.module';
import { SearchModule } from './search/search.module';
import { CertificatesModule } from './certificates/certificates.module';
import { UsersModule } from './users/users.module';
import { AthleteStarsModule } from './athlete-stars/athlete-stars.module';
import { TimingModule } from './timing/timing.module';
import { TimingAlertModule } from './timing-alert/timing-alert.module';
import { EventTrackingModule } from './event-tracking/event-tracking.module';
import { SponsoredModule } from './sponsored/sponsored.module';
import { ArticlesModule } from './articles/articles.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { BugReportsModule } from './bug-reports/bug-reports.module';
import { MerchantModule } from './merchant/merchant.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { Tenant } from './merchant/entities/tenant.entity';
import { ChipVerificationModule } from './chip-verification/chip-verification.module';
import { RaceMasterDataModule } from './race-master-data/race-master-data.module';
import { AthleteReadonly } from './race-master-data/entities/athlete-readonly.entity';
import { AthleteSubinfoReadonly } from './race-master-data/entities/athlete-subinfo-readonly.entity';
import { OrderLineItemReadonly } from './race-master-data/entities/order-line-item-readonly.entity';
import { TicketTypeReadonly } from './race-master-data/entities/ticket-type-readonly.entity';
import { RaceCourseReadonly } from './race-master-data/entities/race-course-readonly.entity';
import { CodeReadonly } from './race-master-data/entities/code-readonly.entity';
import { TeamManagementModule } from './team-management/team-management.module';
import { VolEvent } from './team-management/entities/vol-event.entity';
import { VolRole } from './team-management/entities/vol-role.entity';
import { VolRegistration } from './team-management/entities/vol-registration.entity';
import { VolContractTemplate } from './team-management/entities/vol-contract-template.entity';
import { VolShirtStock } from './team-management/entities/vol-shirt-stock.entity';
import { VolTeamScheduleEmail } from './team-management/entities/vol-team-schedule-email.entity';
import { VolEventContact } from './team-management/entities/vol-event-contact.entity';
import { VolTeamCategory } from './team-management/entities/vol-team-category.entity';
import { VolStation } from './team-management/entities/vol-station.entity';
import { VolStationAssignment } from './team-management/entities/vol-station-assignment.entity';
import { VolSupplyItem } from './team-management/entities/vol-supply-item.entity';
import { VolSupplyPlan } from './team-management/entities/vol-supply-plan.entity';
import { VolSupplyAllocation } from './team-management/entities/vol-supply-allocation.entity';
import { VolSupplySupplement } from './team-management/entities/vol-supply-supplement.entity';
import { VolAcceptanceTemplate } from './team-management/entities/vol-acceptance-template.entity';
import { VolContractNumberSequence } from './team-management/entities/vol-contract-number-sequence.entity';

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
        entities: [
          Tenant,
          // Race Master Data read-only entities — single source of truth cho
          // athlete pre-race data. Centralized ở race-master-data module
          // (v1.3 — moved từ chip-verification per spec). Consumer modules
          // (chip-verify, future checkpoint-capture) KHÔNG có entity riêng,
          // chỉ inject RaceAthleteLookupService qua DI.
          AthleteReadonly,
          AthleteSubinfoReadonly,
          OrderLineItemReadonly,
          TicketTypeReadonly,
          RaceCourseReadonly,
          CodeReadonly,
        ],
        synchronize: false, // KHÔNG auto-sync — DB là readonly
        logging: env.env === 'local' || env.env === 'development',
        extra: {
          // Bumped 5 → 10 per Danny sign-off 2026-04-29 to support cron delta
          // sync running concurrently with Reconciliation queries on race day.
          connectionLimit: 10,
        },
      }),
      MerchantModule,
      // RaceMasterDataModule MUST be loaded BEFORE ChipVerificationModule —
      // ChipVerification v1.3 imports RaceMasterDataModule and injects
      // RaceAthleteLookupService. NestJS resolves DI in module order.
      RaceMasterDataModule,
      ReconciliationModule,
      AnalyticsModule,
      ChipVerificationModule,
    ]
  : [];

// Timing Miss Alert v1.0 — Mongo-native, no MySQL dependency.
// Manager refactor 03/05: drop encryption key (race document apiUrl plaintext).
// Module always loaded — feature flag qua per-race `enabled` field trong config.
const timingAlertModules = [TimingAlertModule];

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
          VolTeamCategory,
          VolStation,
          VolStationAssignment,
          VolSupplyItem,
          VolSupplyPlan,
          VolSupplyAllocation,
          VolSupplySupplement,
          VolAcceptanceTemplate,
          VolContractNumberSequence,
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
    ...timingAlertModules,
    RacesModule,
    RaceResultModule,
    AdminModule,
    LogtoAuthModule,
    UploadModule,
    SponsorsModule,
    NotificationModule,
    HomepageModule,
    SearchModule,
    CertificatesModule,
    UsersModule,
    AthleteStarsModule,
    TimingModule,
    EventTrackingModule,
    SponsoredModule,
    ApiKeysModule,
    ArticlesModule,
    BugReportsModule,
  ],
})
export class AppModule {}
