import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminUser, AdminUserDocument } from '../schemas/admin-user.schema';
import { env } from 'src/config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.adminUserModel
      .findById(payload.sub)
      .select('-password')
      .lean();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Attach userId/sub so controllers can identify the admin (req.user.userId)
    return { ...user, userId: String(user._id), sub: String(user._id) };
  }
}
