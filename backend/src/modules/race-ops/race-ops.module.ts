import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { env } from 'src/config';

// Schemas
import {
  AdminUser,
  AdminUserSchema,
} from '../auth/schemas/admin-user.schema';
import { OpsEvent, OpsEventSchema } from './schemas/ops-event.schema';
import { OpsTeam, OpsTeamSchema } from './schemas/ops-team.schema';
import { OpsUser, OpsUserSchema } from './schemas/ops-user.schema';
import { OpsShift, OpsShiftSchema } from './schemas/ops-shift.schema';
import { OpsCheckIn, OpsCheckInSchema } from './schemas/ops-check-in.schema';
import {
  OpsSupplyItem,
  OpsSupplyItemSchema,
} from './schemas/ops-supply-item.schema';
import {
  OpsSupplyOrder,
  OpsSupplyOrderSchema,
} from './schemas/ops-supply-order.schema';
import { OpsTask, OpsTaskSchema } from './schemas/ops-task.schema';
import { OpsIncident, OpsIncidentSchema } from './schemas/ops-incident.schema';
import {
  OpsAuditLog,
  OpsAuditLogSchema,
} from './schemas/ops-audit-log.schema';

// Strategy + Guards (singletons via DI)
import { OpsJwtStrategy } from './common/strategies/ops-jwt.strategy';

// Services
import { OpsAuthService } from './users/ops-auth.service';
import { AuditService } from './audit/audit.service';
import { EventsService } from './events/events.service';
import { TeamsService } from './teams/teams.service';
import { ApplicationsService } from './users/applications.service';
import { SupplyService } from './supply/supply.service';
import { CheckInsService } from './check-ins/check-ins.service';
import { TasksService } from './tasks/tasks.service';
import { IncidentsService } from './incidents/incidents.service';

// Controllers
import { OpsAuthController } from './users/ops-auth.controller';
import { EventsController } from './events/events.controller';
import { TeamsController } from './teams/teams.controller';
import {
  AdminUsersController,
  PublicApplicationController,
} from './users/applications.controller';
import {
  SupplyItemsController,
  SupplyOrdersController,
} from './supply/supply.controller';
import { CheckInsController } from './check-ins/check-ins.controller';
import { TasksController } from './tasks/tasks.controller';
import { IncidentsController } from './incidents/incidents.controller';

/**
 * RaceOpsModule — Sprint 1 Foundation.
 *
 * Sprint 1 scope:
 *  - 10 Mongoose schemas registered ở forFeature
 *  - OpsJwtStrategy + OpsJwtAuthGuard (tách biệt admin auth)
 *  - OpsAuthService (login email+password)
 *  - AuditService (injectable cho mọi sprint sau)
 *
 * Các submodule (events/teams/supply/tasks/incidents/check-ins) sẽ add dần ở Sprint 2-4.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OpsEvent.name, schema: OpsEventSchema },
      { name: OpsTeam.name, schema: OpsTeamSchema },
      { name: OpsUser.name, schema: OpsUserSchema },
      { name: OpsShift.name, schema: OpsShiftSchema },
      { name: OpsCheckIn.name, schema: OpsCheckInSchema },
      { name: OpsSupplyItem.name, schema: OpsSupplyItemSchema },
      { name: OpsSupplyOrder.name, schema: OpsSupplyOrderSchema },
      { name: OpsTask.name, schema: OpsTaskSchema },
      { name: OpsIncident.name, schema: OpsIncidentSchema },
      { name: OpsAuditLog.name, schema: OpsAuditLogSchema },
      // Admin bridge: OpsJwtStrategy cần load admin_users để accept admin token
      { name: AdminUser.name, schema: AdminUserSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt-ops' }),
    JwtModule.register({
      secret: env.jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    OpsAuthController,
    EventsController,
    TeamsController,
    AdminUsersController,
    PublicApplicationController,
    SupplyItemsController,
    SupplyOrdersController,
    CheckInsController,
    TasksController,
    IncidentsController,
  ],
  providers: [
    OpsJwtStrategy,
    OpsAuthService,
    AuditService,
    EventsService,
    TeamsService,
    ApplicationsService,
    SupplyService,
    CheckInsService,
    TasksService,
    IncidentsService,
  ],
  exports: [AuditService, EventsService, TeamsService, MongooseModule],
})
export class RaceOpsModule {}
