import {
  Injectable,
  OnModuleInit,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminUserDocument } from './schemas/admin-user.schema';

const DEFAULT_ADMIN_EMAIL = 'admin@5bib.vn';
const DEFAULT_ADMIN_PASSWORD = 'Admin@5bib2026';
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.seedAdmin();
  }

  async seedAdmin(): Promise<void> {
    const exists = await this.adminUserModel.findOne({
      email: DEFAULT_ADMIN_EMAIL,
    });

    if (exists) {
      this.logger.log('Default admin already exists, skipping seed.');
      return;
    }

    const hashed = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, BCRYPT_ROUNDS);
    await this.adminUserModel.create({
      email: DEFAULT_ADMIN_EMAIL,
      password: hashed,
      role: 'admin',
      displayName: '5Bib Admin',
    });

    this.logger.log(`Default admin seeded: ${DEFAULT_ADMIN_EMAIL}`);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AdminUserDocument | null> {
    const user = await this.adminUserModel.findOne({ email });
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: Record<string, unknown> }> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }
}
