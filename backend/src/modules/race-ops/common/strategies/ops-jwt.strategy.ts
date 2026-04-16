import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from 'src/config';
import { OpsUser, OpsUserDocument } from '../../schemas/ops-user.schema';
import { OpsJwtPayload, OpsUserContext } from '../types/ops-jwt-payload.type';
import { isOpsRole } from '../types/ops-role.type';

/**
 * Passport strategy dành riêng cho ops tokens (name: 'jwt-ops').
 *
 * Thiết kế tách biệt khỏi admin JwtStrategy:
 *  - Dùng chung `env.jwtSecret` (đơn giản dev), có thể tách secret riêng nếu cần.
 *  - Payload phải có `token_type === 'ops'` → reject nếu không.
 *  - Load từ `ops_users` collection (không phải admin_users).
 *  - Chặn user có `status === 'REJECTED'` hoặc `deleted_at != null`.
 *
 * Ops endpoints dùng `OpsJwtAuthGuard` (extends AuthGuard('jwt-ops')).
 */
@Injectable()
export class OpsJwtStrategy extends PassportStrategy(Strategy, 'jwt-ops') {
  constructor(
    @InjectModel(OpsUser.name)
    private readonly opsUserModel: Model<OpsUserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  async validate(payload: OpsJwtPayload): Promise<OpsUserContext> {
    if (payload.token_type !== 'ops') {
      throw new UnauthorizedException('Not an ops token');
    }

    if (!isOpsRole(payload.role)) {
      throw new UnauthorizedException('Invalid role in token');
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

    if (!payload.tenant_id) {
      throw new UnauthorizedException('Missing tenant_id in token');
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
}
