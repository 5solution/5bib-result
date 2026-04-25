import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { TeamCacheService } from '../services/team-cache.service';

/**
 * Decorator: mark a controller class or handler as requiring `feature_mode = 'full'`.
 * When applied, FeatureModeGuard will reject lite-mode events with 403.
 */
export const RequireFullMode = (): MethodDecorator & ClassDecorator =>
  SetMetadata('require_full_mode', true);

/**
 * Guard that blocks access to Full-mode-only endpoints when the event is in Lite mode.
 * Reads the eventId from request.params.eventId, request.params.id, or request.body.event_id.
 * Uses Redis cache (TTL 300s) to avoid a DB hit on every guarded request.
 */
@Injectable()
export class FeatureModeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    private readonly cache: TeamCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireFull = this.reflector.getAllAndOverride<boolean>(
      'require_full_mode',
      [context.getHandler(), context.getClass()],
    );
    if (!requireFull) return true;

    const request = context
      .switchToHttp()
      .getRequest<{
        params?: Record<string, string>;
        body?: Record<string, unknown>;
      }>();

    const rawId =
      request.params?.['eventId'] ??
      request.params?.['id'] ??
      request.body?.['event_id'];
    const eventId = rawId != null ? parseInt(String(rawId), 10) : NaN;

    // If we cannot determine the eventId, let the endpoint's own validation handle it.
    if (isNaN(eventId)) return true;

    // Try cache first to avoid DB hit on every guarded request.
    const cached = await this.cache.getEventConfig(eventId);
    const mode = cached
      ? cached.feature_mode
      : (
          await this.eventRepo.findOne({
            where: { id: eventId },
            select: ['feature_mode'],
          })
        )?.feature_mode ?? 'full';

    if (mode !== 'full') {
      throw new ForbiddenException(
        'Tính năng này không khả dụng ở chế độ Lite. Chuyển sang Full mode trong Cài đặt sự kiện để sử dụng.',
      );
    }
    return true;
  }
}
