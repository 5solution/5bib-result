import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { s3ClientProvider } from '../aws.config';
import { VolEvent } from './entities/vol-event.entity';
import { VolRole } from './entities/vol-role.entity';
import { VolRegistration } from './entities/vol-registration.entity';
import { VolContractTemplate } from './entities/vol-contract-template.entity';
import { VolShirtStock } from './entities/vol-shirt-stock.entity';
import { VolTeamScheduleEmail } from './entities/vol-team-schedule-email.entity';
import { VolEventContact } from './entities/vol-event-contact.entity';
import { VolStation } from './entities/vol-station.entity';
import { VolStationAssignment } from './entities/vol-station-assignment.entity';
import { VolSupplyItem } from './entities/vol-supply-item.entity';
import { VolSupplyPlan } from './entities/vol-supply-plan.entity';
import { VolSupplyAllocation } from './entities/vol-supply-allocation.entity';
import { VolSupplySupplement } from './entities/vol-supply-supplement.entity';
import { TeamEventService } from './services/team-event.service';
import { TeamRegistrationService } from './services/team-registration.service';
import { TeamPhotoService } from './services/team-photo.service';
import { TeamCacheService } from './services/team-cache.service';
import { TeamContractService } from './services/team-contract.service';
import { TeamCheckinService } from './services/team-checkin.service';
import { TeamReminderService } from './services/team-reminder.service';
import { TeamShirtService } from './services/team-shirt.service';
import { TeamDashboardService } from './services/team-dashboard.service';
import { TeamExportService } from './services/team-export.service';
import { TeamRoleImportService } from './services/team-role-import.service';
import { TeamRegistrationImportService } from './services/team-registration-import.service';
import { TeamScheduleEmailService } from './services/team-schedule-email.service';
import { TeamLeaderService } from './services/team-leader.service';
import { TeamContactService } from './services/team-contact.service';
import { TeamDirectoryService } from './services/team-directory.service';
import { TeamStationService } from './services/team-station.service';
import { TeamSupplyItemService } from './services/team-supply-item.service';
import { TeamSupplyPlanService } from './services/team-supply-plan.service';
import { TeamSupplyAllocationService } from './services/team-supply-allocation.service';
import { TeamSupplySupplementService } from './services/team-supply-supplement.service';
import { TeamSupplyLeaderService } from './services/team-supply-leader.service';
import { TeamManagementController } from './team-management.controller';
import { TeamRegistrationController } from './team-registration.controller';
import { TeamRegistrationImportController } from './team-registration-import.controller';
import { TeamContractTemplateController } from './team-contract-template.controller';
import { TeamCheckinController } from './team-checkin.controller';
import { TeamScheduleEmailController } from './team-schedule-email.controller';
import { TeamLeaderController } from './team-leader.controller';
import { TeamContactController } from './team-contact.controller';
import { TeamDirectoryController } from './team-directory.controller';
import { TeamStationController } from './team-station.controller';
import { TeamSupplyController } from './team-supply.controller';
import { TeamSupplyPublicController } from './team-supply-public.controller';
import { env } from 'src/config';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
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
      'volunteer',
    ),
    ThrottlerModule.forRoot([
      {
        ttl: env.teamManagement.rateLimitTtlMs,
        limit: env.teamManagement.rateLimitMax,
      },
    ]),
  ],
  controllers: [
    TeamManagementController,
    TeamRegistrationController,
    TeamRegistrationImportController,
    TeamContractTemplateController,
    TeamCheckinController,
    TeamScheduleEmailController,
    TeamLeaderController,
    TeamContactController,
    TeamDirectoryController,
    TeamStationController,
    TeamSupplyController,
    TeamSupplyPublicController,
  ],
  providers: [
    TeamEventService,
    TeamRegistrationService,
    TeamPhotoService,
    TeamCacheService,
    TeamContractService,
    TeamCheckinService,
    TeamReminderService,
    TeamShirtService,
    TeamDashboardService,
    TeamExportService,
    TeamRoleImportService,
    TeamRegistrationImportService,
    TeamScheduleEmailService,
    TeamLeaderService,
    TeamContactService,
    TeamDirectoryService,
    TeamStationService,
    TeamSupplyItemService,
    TeamSupplyPlanService,
    TeamSupplyAllocationService,
    TeamSupplySupplementService,
    TeamSupplyLeaderService,
    s3ClientProvider,
    // Make every route within this module subject to @Throttle decorators.
    // Without this provider the @Throttle calls on public endpoints are no-ops.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [TeamEventService, TeamRegistrationService, TeamContractService],
})
export class TeamManagementModule {}
