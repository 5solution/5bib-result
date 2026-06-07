import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { Model } from 'mongoose';
import { In, Repository } from 'typeorm';
import { env } from '../../../config';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { LogtoService } from '../../logto-auth/logto.service';
import { Tenant } from '../../merchant/entities/tenant.entity';
import { MailService } from '../../notification/mail.service';
import {
  AccessConfigListQueryDto,
  AccessConfigListResponseDto,
  AccessConfigResponseDto,
  CreateAccessConfigDto,
  DeleteAccessConfigResponseDto,
  UpdateAccessConfigDto,
} from '../dto/access-config.dto';
import { LogtoLookupResponseDto } from '../dto/logto-lookup.dto';
import {
  MerchantPortalAccess,
  MerchantPortalAccessDocument,
} from '../schemas/merchant-portal-access.schema';

const MERCHANT_ACCESS_LOCK_TTL_SECONDS = 10;

@Injectable()
export class MerchantPortalAccessService {
  private readonly logger = new Logger(MerchantPortalAccessService.name);

  constructor(
    @InjectModel(MerchantPortalAccess.name)
    private readonly accessModel: Model<MerchantPortalAccessDocument>,
    @InjectRepository(Tenant, 'platform')
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly auditLog: AuditLogService,
    private readonly logtoService: LogtoService,
    private readonly mailService: MailService,
  ) {}

  private accessLockKey(userId: string): string {
    return `merchant-access-lock:${userId}`;
  }

  private async acquireAccessLock(userId: string): Promise<() => Promise<void>> {
    const key = this.accessLockKey(userId);
    const acquired = await this.redis.set(
      key,
      '1',
      'EX',
      MERCHANT_ACCESS_LOCK_TTL_SECONDS,
      'NX',
    );
    if (acquired !== 'OK') {
      throw new ConflictException({
        statusCode: 409,
        errorCode: '409_CONCURRENT_EDIT',
        message: {
          vi: 'Đang có admin khác cập nhật quyền của user này, vui lòng thử lại sau vài giây.',
          en: "Another admin is updating this user's access, please retry in a few seconds.",
        },
      });
    }
    return async () => {
      try {
        await this.redis.del(key);
      } catch (err) {
        this.logger.warn(
          `Failed to release access lock ${key}: ${(err as Error).message}`,
        );
      }
    };
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const patterns = [
        `merchant-portal:access:${userId}`,
        `merchant-portal:races:${userId}`,
        `merchant-portal:*:${userId}:*`,
        `logto-lookup:byid:${userId}`,
      ];
      const pipeline = this.redis.pipeline();
      let count = 0;
      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          const stream = this.redis.scanStream({ match: pattern, count: 200 });
          await new Promise<void>((resolve, reject) => {
            stream.on('data', (keys: string[]) => {
              for (const k of keys) {
                pipeline.del(k);
                count++;
              }
            });
            stream.on('end', () => resolve());
            stream.on('error', reject);
          });
        } else {
          pipeline.del(pattern);
          count++;
        }
      }
      if (count > 0) await pipeline.exec();
    } catch (err) {
      this.logger.warn(
        `Cache invalidation failed for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }

  private async validateTenantIds(
    tenantIds: number[],
  ): Promise<Map<number, string>> {
    if (!tenantIds.length) return new Map();
    const tenants = await this.tenantRepo.find({
      where: { id: In(tenantIds) },
      select: ['id', 'name'],
    });
    const foundIds = new Set(tenants.map((t) => Number(t.id)));
    const missing = tenantIds.find((id) => !foundIds.has(id));
    if (missing !== undefined) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: '400_INVALID_TENANT',
        message: {
          vi: `BTC với ID ${missing} không tồn tại`,
          en: `Merchant with ID ${missing} does not exist`,
        },
      });
    }
    return new Map(tenants.map((t) => [Number(t.id), t.name]));
  }

  private assertScopeNonEmpty(tenantIds: number[], includeRaces: number[]): void {
    if (tenantIds.length === 0 && includeRaces.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: '400_SCOPE_EMPTY',
        message: {
          vi: 'Vui lòng chọn ít nhất 1 BTC hoặc 1 giải cụ thể',
          en: 'Please select at least 1 merchant or 1 specific race',
        },
      });
    }
  }

  private assertPermissionsValid(permissions: string[]): void {
    if (!permissions.includes('ticket_report')) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: '400_PERMISSION_INVALID',
        message: {
          vi: 'Quyền `revenue_report` phải đi kèm `ticket_report`',
          en: '`revenue_report` permission requires `ticket_report`',
        },
      });
    }
  }

  private toResponse(doc: MerchantPortalAccessDocument): AccessConfigResponseDto {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      userName: doc.userName,
      email: doc.email,
      tenantIds: doc.tenantIds,
      raceOverrides: {
        include: doc.raceOverrides?.include ?? [],
        exclude: doc.raceOverrides?.exclude ?? [],
      },
      permissions: doc.permissions,
      isActive: doc.isActive,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(
    dto: CreateAccessConfigDto,
    actorUserId: string,
  ): Promise<AccessConfigResponseDto> {
    const tenantIds = dto.tenantIds ?? [];
    const include = dto.raceOverrides?.include ?? [];
    const exclude = dto.raceOverrides?.exclude ?? [];
    this.assertScopeNonEmpty(tenantIds, include);
    this.assertPermissionsValid(dto.permissions);
    await this.validateTenantIds(tenantIds);
    const resolved = await this.resolveOrProvisionUser(dto);
    const release = await this.acquireAccessLock(resolved.userId);
    try {
      const existing = await this.accessModel
        .findOne({ userId: resolved.userId })
        .lean()
        .exec();
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          errorCode: '409_DUPLICATE',
          message: {
            vi: 'Người dùng này đã có cấu hình. Vui lòng chỉnh sửa cấu hình hiện tại.',
            en: 'This user already has a config. Please edit the existing one.',
          },
        });
      }
      const doc = await this.accessModel.create({
        userId: resolved.userId,
        userName: resolved.userName,
        email: dto.email,
        tenantIds,
        raceOverrides: { include, exclude },
        permissions: dto.permissions,
        isActive: dto.isActive ?? true,
        createdBy: actorUserId,
      });
      const isCrossTenant = tenantIds.length > 1;
      await this.auditLog.emit({
        actor: { userId: actorUserId, role: 'admin' },
        action: 'merchant_access.create',
        entity: {
          type: 'merchant_portal_access',
          id: doc._id.toString(),
          displayName: resolved.userName,
        },
        metadata: {
          targetUserId: resolved.userId,
          tenantIds,
          permissions: dto.permissions,
          isCrossTenant,
          provisioned: resolved.provisioned,
        },
      });
      await this.invalidateUserCache(resolved.userId);
      return {
        ...this.toResponse(doc),
        provisioned: resolved.provisioned,
        inviteEmailSent: resolved.inviteEmailSent,
      };
    } finally {
      await release();
    }
  }

  private async resolveOrProvisionUser(dto: CreateAccessConfigDto): Promise<{
    userId: string;
    userName: string;
    provisioned: boolean;
    inviteEmailSent: boolean;
  }> {
    if (dto.userId && dto.userId.trim()) {
      return {
        userId: dto.userId.trim(),
        userName: dto.userName,
        provisioned: false,
        inviteEmailSent: false,
      };
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.logtoService.lookupByEmail(email);
    if (existing) {
      return {
        userId: existing.userId,
        userName: dto.userName || existing.name || email,
        provisioned: false,
        inviteEmailSent: false,
      };
    }
    const roleNames = dto.permissions.includes('revenue_report')
      ? ['merchant_finance']
      : ['merchant_viewer'];
    let newUserId: string;
    try {
      newUserId = await this.logtoService.createUser(email, dto.userName);
      const roleIds = await this.logtoService.resolveRoleIdsByNames(roleNames);
      await this.logtoService.assignUserRoles(newUserId, roleIds);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`M3b provision failed for ${email}: ${msg}`);
      if (/LOGTO_M2M_UNCONFIGURED|\b403\b/.test(msg)) {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: '400_PROVISION_NO_SCOPE',
          message: {
            vi: 'Hệ thống chưa đủ quyền tạo tài khoản trên Logto (M2M app thiếu scope). Liên hệ kỹ thuật bật quyền, hoặc tạo tài khoản thủ công rồi gán lại.',
            en: 'Logto M2M app lacks user-creation scope. Enable it or create the user manually.',
          },
        });
      }
      throw new BadRequestException({
        statusCode: 400,
        errorCode: '400_PROVISION_FAILED',
        message: {
          vi: 'Không tạo được tài khoản cho email này trên Logto. Kiểm tra email có hợp lệ / chưa tồn tại.',
          en: `Failed to provision Logto user: ${msg}`,
        },
      });
    }
    let inviteEmailSent = false;
    try {
      inviteEmailSent = await this.mailService.sendCustomHtml(
        email,
        '5BIB — Bạn được cấp quyền xem báo cáo giải chạy',
        this.buildInviteHtml(dto.userName, env.logto.merchantLoginUrl),
      );
    } catch (err) {
      this.logger.warn(
        `M3b invite email failed for ${email}: ${(err as Error).message}`,
      );
    }
    return {
      userId: newUserId,
      userName: dto.userName,
      provisioned: true,
      inviteEmailSent,
    };
  }

  private buildInviteHtml(name: string, loginUrl: string): string {
    const safeName = (name || 'bạn').replace(/</g, '&lt;');
    return [
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1c1917">`,
      `<p>Xin chào ${safeName},</p>`,
      `<p>Bạn vừa được Ban tổ chức cấp quyền xem báo cáo giải chạy trên <b>5BIB Merchant Portal</b>.</p>`,
      `<p>Đăng nhập bằng chính email này (không cần mật khẩu — hệ thống gửi mã đăng nhập qua email):</p>`,
      `<p><a href="${loginUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Đăng nhập Merchant Portal</a></p>`,
      `<p style="color:#78716c;font-size:12px">Nếu nút không bấm được, mở liên kết: ${loginUrl}</p>`,
      `</div>`,
    ].join('');
  }

  async findAll(
    query: AccessConfigListQueryDto,
  ): Promise<AccessConfigListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const filter: Record<string, unknown> = {};
    if (query.q) {
      const regex = new RegExp(
        query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [{ userName: regex }, { email: regex }];
    }
    if (query.tenantId !== undefined) {
      filter.tenantIds = query.tenantId;
    }
    if (query.permissionFilter === 'ticket_only') {
      filter.permissions = { $size: 1, $all: ['ticket_report'] };
    } else if (query.permissionFilter === 'ticket_and_revenue') {
      filter.permissions = { $all: ['ticket_report', 'revenue_report'] };
    }
    if (query.statusFilter === 'active') {
      filter.isActive = true;
    } else if (query.statusFilter === 'inactive') {
      filter.isActive = false;
    }
    const [docs, total] = await Promise.all([
      this.accessModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.accessModel.countDocuments(filter).exec(),
    ]);
    const allTenantIds = Array.from(
      new Set(docs.flatMap((d) => d.tenantIds ?? [])),
    );
    const tenantNameMap = await this.lookupTenantNames(allTenantIds);
    const items = docs.map((doc) => {
      const baseResp = this.toResponse(doc);
      const include = doc.raceOverrides?.include ?? [];
      const exclude = doc.raceOverrides?.exclude ?? [];
      let raceCount: number | '__all';
      if (doc.tenantIds.length > 0 && exclude.length === 0) {
        raceCount = '__all';
      } else if (doc.tenantIds.length === 0) {
        raceCount = include.length;
      } else {
        raceCount = '__all';
      }
      return {
        ...baseResp,
        raceCount,
        tenantNames: doc.tenantIds
          .map((id) => tenantNameMap.get(id) ?? `Tenant #${id}`)
          .filter(Boolean),
      };
    });
    return { items, total, page, pageSize };
  }

  private async lookupTenantNames(
    ids: number[],
  ): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    try {
      const tenants = await this.tenantRepo.find({
        where: { id: In(ids) },
        select: ['id', 'name'],
      });
      return new Map(tenants.map((t) => [Number(t.id), t.name]));
    } catch (err) {
      this.logger.warn(`Tenant name lookup failed: ${(err as Error).message}`);
      return new Map();
    }
  }

  async findOne(id: string): Promise<AccessConfigResponseDto> {
    const doc = await this.accessModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        message: { vi: 'Không tìm thấy cấu hình', en: 'Config not found' },
      });
    }
    return this.toResponse(doc);
  }

  async update(
    id: string,
    dto: UpdateAccessConfigDto,
    actorUserId: string,
  ): Promise<AccessConfigResponseDto> {
    const existing = await this.accessModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        message: { vi: 'Không tìm thấy cấu hình', en: 'Config not found' },
      });
    }
    const finalTenantIds = dto.tenantIds ?? existing.tenantIds;
    const finalInclude =
      dto.raceOverrides?.include ?? existing.raceOverrides?.include ?? [];
    const finalExclude =
      dto.raceOverrides?.exclude ?? existing.raceOverrides?.exclude ?? [];
    const finalPermissions = dto.permissions ?? existing.permissions;
    this.assertScopeNonEmpty(finalTenantIds, finalInclude);
    this.assertPermissionsValid(finalPermissions);
    if (dto.tenantIds) await this.validateTenantIds(finalTenantIds);
    const release = await this.acquireAccessLock(existing.userId);
    try {
      const stillExists = await this.accessModel.exists({ _id: existing._id });
      if (!stillExists) {
        throw new NotFoundException({
          statusCode: 404,
          message: {
            vi: 'Cấu hình đã bị xóa bởi người khác',
            en: 'Config was deleted by another admin',
          },
        });
      }
      const before = {
        tenantIds: existing.tenantIds,
        raceOverrides: existing.raceOverrides,
        permissions: existing.permissions,
        isActive: existing.isActive,
        userName: existing.userName,
        email: existing.email,
      };
      if (dto.userName !== undefined) existing.userName = dto.userName;
      if (dto.email !== undefined) existing.email = dto.email;
      if (dto.tenantIds !== undefined) existing.tenantIds = finalTenantIds;
      if (dto.raceOverrides !== undefined) {
        existing.raceOverrides = {
          include: finalInclude,
          exclude: finalExclude,
        };
      }
      if (dto.permissions !== undefined) existing.permissions = finalPermissions;
      if (dto.isActive !== undefined) existing.isActive = dto.isActive;
      existing.updatedBy = actorUserId;
      await existing.save();
      const after = {
        tenantIds: existing.tenantIds,
        raceOverrides: existing.raceOverrides,
        permissions: existing.permissions,
        isActive: existing.isActive,
        userName: existing.userName,
        email: existing.email,
      };
      const action =
        dto.isActive !== undefined &&
        Object.keys(dto).length === 1 &&
        before.isActive !== after.isActive
          ? 'merchant_access.toggle'
          : 'merchant_access.update';
      await this.auditLog.emit({
        actor: { userId: actorUserId, role: 'admin' },
        action,
        entity: {
          type: 'merchant_portal_access',
          id: existing._id.toString(),
          displayName: existing.userName,
        },
        metadata: {
          targetUserId: existing.userId,
          changes: { before, after },
        },
      });
      await this.invalidateUserCache(existing.userId);
      return this.toResponse(existing);
    } finally {
      await release();
    }
  }

  async delete(
    id: string,
    actorUserId: string,
  ): Promise<DeleteAccessConfigResponseDto> {
    const existing = await this.accessModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        message: { vi: 'Không tìm thấy cấu hình', en: 'Config not found' },
      });
    }
    const release = await this.acquireAccessLock(existing.userId);
    try {
      const stillExists = await this.accessModel.exists({ _id: existing._id });
      if (!stillExists) {
        throw new NotFoundException({
          statusCode: 404,
          message: {
            vi: 'Cấu hình đã bị xóa bởi người khác',
            en: 'Config was already deleted by another admin',
          },
        });
      }
      await this.auditLog.emit({
        actor: { userId: actorUserId, role: 'admin' },
        action: 'merchant_access.delete',
        entity: {
          type: 'merchant_portal_access',
          id: existing._id.toString(),
          displayName: existing.userName,
        },
        metadata: {
          targetUserId: existing.userId,
          snapshot: {
            tenantIds: existing.tenantIds,
            raceOverrides: existing.raceOverrides,
            permissions: existing.permissions,
            isActive: existing.isActive,
          },
        },
      });
      await this.accessModel.deleteOne({ _id: existing._id }).exec();
      await this.invalidateUserCache(existing.userId);
      return { success: true, deletedUserId: existing.userId };
    } finally {
      await release();
    }
  }

  async lookupLogto(q: string): Promise<LogtoLookupResponseDto> {
    const isEmail = q.includes('@');
    const user = isEmail
      ? await this.logtoService.lookupByEmail(q)
      : await this.logtoService.lookupByIdWithCache(q);
    return {
      found: user !== null,
      user,
      source: 'api',
    };
  }
}
