import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

/**
 * BR-02: race_id LUÔN từ URL path. Body cũng cấm có `mysql_race_id`
 * (defense in depth — controller validates DTO, guard double-checks).
 *
 * Combined with LogtoAdminGuard (apply trước) đảm bảo: user authenticated
 * + race_id từ params không phải body.
 */
@Injectable()
export class RaceScopeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      params: Record<string, string>;
      body?: Record<string, unknown>;
    }>();

    const raw = req.params?.raceId;
    if (!raw) {
      throw new BadRequestException('Missing raceId path param');
    }
    const raceId = Number(raw);
    if (!Number.isFinite(raceId) || raceId <= 0) {
      throw new BadRequestException('Invalid raceId path param');
    }

    // Reject any attempt to override via body
    if (
      req.body &&
      typeof req.body === 'object' &&
      'mysql_race_id' in req.body
    ) {
      throw new BadRequestException(
        'mysql_race_id is not allowed in body — race scope from path only',
      );
    }

    // Mutate params with parsed number for downstream use
    (req.params as Record<string, string | number>).raceId = raceId;
    return true;
  }
}
