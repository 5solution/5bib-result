import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { OpsUser, OpsUserDocument } from '../schemas/ops-user.schema';
import { OpsEvent, OpsEventDocument } from '../schemas/ops-event.schema';
import { OpsJwtPayload } from '../common/types/ops-jwt-payload.type';
import { OpsLoginDto, OpsLoginResponseDto } from './dto/ops-auth.dto';

/**
 * Auth service cho ops_admin / ops_leader — login bằng email + password.
 * Crew/TNV không login password → login flow sẽ add sau (Sprint 2+) qua magic link.
 */
@Injectable()
export class OpsAuthService {
  constructor(
    @InjectModel(OpsUser.name)
    private readonly opsUserModel: Model<OpsUserDocument>,
    @InjectModel(OpsEvent.name)
    private readonly opsEventModel: Model<OpsEventDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: OpsLoginDto): Promise<OpsLoginResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.opsUserModel
      .findOne({ email: normalizedEmail, deleted_at: null })
      .lean();

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'REJECTED') {
      throw new UnauthorizedException('Account rejected');
    }

    // Chỉ admin/leader login bằng password. Reject nếu role khác.
    if (user.role !== 'ops_admin' && user.role !== 'ops_leader') {
      throw new UnauthorizedException('Role not allowed for password login');
    }

    // Resolve tenant_id từ event (single lookup tại login)
    const event = await this.opsEventModel
      .findById(user.event_id)
      .select('tenant_id')
      .lean();
    if (!event) {
      throw new UnauthorizedException('Event not found for user');
    }

    const payload: OpsJwtPayload = {
      sub: String(user._id),
      token_type: 'ops',
      role: user.role,
      tenant_id: String(event.tenant_id),
      event_id: String(user.event_id),
      team_id: user.team_id ? String(user.team_id) : undefined,
      email: user.email,
      phone: user.phone,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      access_token,
      role: user.role,
      user_id: String(user._id),
      event_id: String(user.event_id),
      team_id: user.team_id ? String(user.team_id) : null,
      full_name: user.full_name,
    };
  }

  /** Hash password dùng chung khi admin tạo account. */
  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
