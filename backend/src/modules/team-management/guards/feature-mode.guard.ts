import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
 *
 * Resolution chain (FAIL CLOSED — v1.9 CRIT-01 fix):
 *   1. `params.eventId` (most specific, used by /events/:eventId/*)
 *   2. `body.event_id`
 *   3. Resource lookup by route pattern:
 *      - /stations/:id, /stations/:id/* → vol_station.event_id
 *      - /supply-items/:id → vol_supply_item.event_id
 *      - /supply-allocations/:id, /supply-allocations/:id/* → resolved via station→category→event
 *      - /station-assignments/:assignmentId → resolved via station→event
 *      - /team-categories/:categoryId/* → vol_team_category.event_id
 *      - /checkin/scan, /checkin/lookup → resolve via qr_code → registration.event_id
 *
 * If we cannot resolve eventId, we DENY (throw 400) instead of allowing.
 * Previous version fell back to 'full' which silently bypassed the guard
 * for any route where `:id` was a non-event resource.
 */
@Injectable()
export class FeatureModeGuard implements CanActivate {
  private readonly logger = new Logger(FeatureModeGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    private readonly cache: TeamCacheService,
    @InjectDataSource('volunteer')
    private readonly dataSource: DataSource,
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
        query?: Record<string, unknown>;
        url?: string;
        path?: string;
      }>();

    const eventId = await this.resolveEventId(request);
    if (eventId == null) {
      // Fail closed — could not determine event scope from request.
      // This is safer than the legacy fallback to 'full' which silently
      // allowed bypass via routes whose `:id` was a non-event resource.
      this.logger.warn(
        `FeatureModeGuard: cannot resolve eventId for ${request.path ?? request.url ?? 'unknown'} — denying`,
      );
      throw new ForbiddenException(
        'Không xác định được sự kiện cho yêu cầu này. Vui lòng dùng route có :eventId hoặc gửi event_id trong body.',
      );
    }

    // Try cache first to avoid DB hit on every guarded request.
    const cached = await this.cache.getEventConfig(eventId);
    const mode = cached
      ? cached.feature_mode
      : (
          await this.eventRepo.findOne({
            where: { id: eventId },
            select: ['feature_mode'],
          })
        )?.feature_mode ?? null;

    if (mode == null) {
      // Event not found — let downstream handlers return their proper 404.
      return true;
    }

    if (mode !== 'full') {
      throw new ForbiddenException(
        'Tính năng này không khả dụng ở chế độ Lite. Chuyển sang Full mode trong Cài đặt sự kiện để sử dụng.',
      );
    }
    return true;
  }

  /**
   * Resolve event_id from a guarded request. Returns null if no source matches.
   *
   * Order:
   *   1. params.eventId (explicit)
   *   2. body.event_id
   *   3. URL path inspection → resource lookup
   *   4. body.qr_code or query.qr_code → registration.event_id
   */
  private async resolveEventId(request: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    url?: string;
    path?: string;
  }): Promise<number | null> {
    // 1. Explicit params.eventId
    const explicitParam = request.params?.['eventId'];
    if (explicitParam != null) {
      const n = parseInt(String(explicitParam), 10);
      if (!isNaN(n)) return n;
    }

    // 2. body.event_id
    const bodyEventId = request.body?.['event_id'];
    if (bodyEventId != null) {
      const n = parseInt(String(bodyEventId), 10);
      if (!isNaN(n)) return n;
    }

    // 3. URL path → resource resolution
    const url = (request.path ?? request.url ?? '').split('?')[0];
    const id = request.params?.['id'];
    const assignmentId = request.params?.['assignmentId'];
    const categoryId = request.params?.['categoryId'];
    const stationId = request.params?.['stationId'];

    try {
      if (categoryId != null && /\/team-categories\/\d+/.test(url)) {
        const r = await this.dataSource.query(
          'SELECT event_id FROM vol_team_category WHERE id = ? LIMIT 1',
          [parseInt(categoryId, 10)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }

      if (stationId != null && /\/stations\/\d+\/allocations/.test(url)) {
        const r = await this.dataSource.query(
          'SELECT event_id FROM vol_station WHERE id = ? LIMIT 1',
          [parseInt(stationId, 10)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }

      if (id != null && /\/stations\/\d+/.test(url)) {
        const r = await this.dataSource.query(
          'SELECT event_id FROM vol_station WHERE id = ? LIMIT 1',
          [parseInt(id, 10)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }

      if (id != null && /\/supply-items\/\d+/.test(url)) {
        const r = await this.dataSource.query(
          'SELECT event_id FROM vol_supply_item WHERE id = ? LIMIT 1',
          [parseInt(id, 10)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }

      if (id != null && /\/supply-allocations\/\d+/.test(url)) {
        // allocation → station → event
        const r = await this.dataSource.query(
          `SELECT s.event_id
             FROM vol_supply_allocation a
             JOIN vol_station s ON s.id = a.station_id
             WHERE a.id = ? LIMIT 1`,
          [parseInt(id, 10)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }

      if (assignmentId != null && /\/station-assignments\/\d+/.test(url)) {
        // assignment → station → event
        const r = await this.dataSource.query(
          `SELECT s.event_id
             FROM vol_station_assignment a
             JOIN vol_station s ON s.id = a.station_id
             WHERE a.id = ? LIMIT 1`,
          [parseInt(assignmentId, 10)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }

      // 4. /checkin/scan and /checkin/lookup → resolve by qr_code or magic_token
      const qrCode = request.body?.['qr_code'] ?? request.query?.['qr_code'];
      if (qrCode != null && /\/checkin\//.test(url)) {
        const r = await this.dataSource.query(
          'SELECT event_id FROM vol_registration WHERE qr_code = ? OR magic_token = ? LIMIT 1',
          [String(qrCode), String(qrCode)],
        );
        if (r[0]?.event_id) return r[0].event_id;
      }
    } catch (err) {
      this.logger.warn(
        `FeatureModeGuard resolve error: ${(err as Error).message}`,
      );
    }

    return null;
  }
}
