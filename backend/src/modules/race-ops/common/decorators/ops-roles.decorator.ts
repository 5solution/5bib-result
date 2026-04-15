import { SetMetadata } from '@nestjs/common';
import { OpsRole } from '../types/ops-role.type';

export const OPS_ROLES_KEY = 'ops_roles';

/**
 * Khai báo role nào được phép truy cập endpoint.
 * Dùng chung với `OpsRoleGuard`.
 *
 * @example
 * @UseGuards(JwtAuthGuard, OpsRoleGuard)
 * @OpsRoles('ops_admin')
 * @Post('events')
 * createEvent(...) {}
 */
export const OpsRoles = (...roles: OpsRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(OPS_ROLES_KEY, roles);
