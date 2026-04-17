import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from 'src/config';
import {
  AdminUser,
  AdminUserDocument,
} from '../../../auth/schemas/admin-user.schema';
import { OpsUser, OpsUserDocument } from '../../schemas/ops-user.schema';
import { OpsJwtPayload, OpsUserContext } from '../types/ops-jwt-payload.type';
import { isOpsRole } from '../types/ops-role.type';

/**
 * Passport strategy dành riêng cho ops tokens (name: 'jwt-ops').
 *
 * Thiết kế:
 *  - Dùng chung `env.jwtSecret` với admin strategy (đơn giản dev).
 *  - Accept 2 loại payload:
 *    1. **Ops token** (`token_type === 'ops'`): load từ `ops_users`, enforce
 *       `tenant_id`, `event_id`, `team_id` từ signed payload.
 *    2. **Admin token** (`role === 'admin'`, không có `token_type`): load từ
 *       `admin_users`, synthesize role='ops_admin' + `tenant_id=env.ops.defaultTenantId`.
 *       Single-tenant MVP nên admin dùng chung Admin Dashboard UI để quản race-ops.
 *  - Chặn user có `status === 'REJECTED'` hoặc `deleted_at != null`.
 *
 * Ops endpoints dùng `OpsJwtAuthGuard` (extends AuthGuard('jwt-ops')).
 */
@Injectable()
export class OpsJwtStrategy extends PassportStrategy(Strategy, 'jwt-ops') {
  constructor(
    @InjectModel(OpsUser.name)
    private readonly opsUserModel: Model<OpsUserDocument>,
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  async validate(payload: OpsJwtPayload): Promise<OpsUserContext> {
    // Branch 1: Admin bridge — admin JWT (role='admin', no token_type)
    if (payload.role === 'admin' || payload.token_type !== 'ops') {
      return this.validateAdminBridge(payload);
    }

    // Branch 2: Native ops token
    return this.validateOpsToken(payload);
  }

  /**
   * Validate native ops token (signed by /race-ops/auth/login).
   */
  private async validateOpsToken(
    payload: OpsJwtPayload,
  ): Promise<OpsUserContext> {
    if (!isOpsRole(payload.role)) {
      throw new UnauthorizedException('Invalid role in token');
    }

    if (!payload.tenant_id) {
      throw new UnauthorizedException('Missing tenant_id in ops token');
    }

    const user = await this.opsUserModel
      .findById(payload.sub)
      .select('-password_hash -qr_token_hash')
      .lean();

    if (!user) {
      throw new UnauthorizedException('Ops user not found');
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Account deactivated');
    }

    if (user.status === 'REJECTED') {
      throw new UnauthorizedException('Account rejected');
    }

    const ctx: OpsUserContext = {
      userId: String(user._id),
      sub: String(user._id),
      token_type: 'ops',
      role: user.role,
      tenant_id: payload.tenant_id,
      event_id: String(user.event_id),
      team_id: user.team_id ? String(user.team_id) : undefined,
      email: user.email,
      phone: user.phone,
      full_name: user.full_name,
    };

    return ctx;
  }

  /**
   * Validate admin bridge — admin JWT được accept như ops_admin vì single-tenant MVP.
   * Admin dashboard chia sẻ UI để quản race-ops mà không cần dual login.
   * Tenant_id synthesize từ env default.
   */
  private async validateAdminBridge(
    payload: OpsJwtPayload,
  ): Promise<OpsUserContext> {
    const admin = await this.adminUserModel
      .findById(payload.sub)
      .select('-password')
      .lean();

    if (!admin) {
      throw new UnauthorizedException('Admin user not found');
    }

    // Admin role trong admin_users có thể là 'admin' hoặc khác (legacy).
    // Chấp nhận tất cả role từ admin_users — implicit trust vì đã qua admin login.
    const ctx: OpsUserContext = {
      userId: String(admin._id),
      sub: String(admin._id),
      token_type: 'admin-bridge',
      role: 'ops_admin', // admin mapped to ops_admin for role-guard
      tenant_id: env.ops.defaultTenantId,
      event_id: '', // resolved per-request từ URL param :eventId
      team_id: undefined,
      email: admin.email,
      phone: '', // admin không có phone
      full_name: admin.displayName || admin.email,
    };

    return ctx;
  }
}
