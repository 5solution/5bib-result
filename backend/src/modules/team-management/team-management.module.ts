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
import { TeamEventService } from './services/team-event.service';
import { TeamRegistrationService } from './services/team-registration.service';
import { TeamPhotoService } from './services/team-photo.service';
import { TeamCacheService } from './services/team-cache.service';
import { TeamManagementController } from './team-management.controller';
import { TeamRegistrationController } from './team-registration.controller';
import { env } from 'src/config';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [VolEvent, VolRole, VolRegistration, VolContractTemplate, VolShirtStock],
      'volunteer',
    ),
    ThrottlerModule.forRoot([
      {
        ttl: env.teamManagement.rateLimitTtlMs,
        limit: env.teamManagement.rateLimitMax,
      },
    ]),
  ],
  controllers: [TeamManagementController, TeamRegistrationController],
  providers: [
    TeamEventService,
    TeamRegistrationService,
    TeamPhotoService,
    TeamCacheService,
    s3ClientProvider,
    // Make every route within this module subject to @Throttle decorators.
    // Without this provider the @Throttle calls on public endpoints are no-ops.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [TeamEventService, TeamRegistrationService],
})
export class TeamManagementModule {}
