import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  resolvePeriod,
  buildMetricCacheKey,
  PeriodKind,
} from './period-resolver';
import {
  TimeToFillResponseDto,
  TimeToFillCourseDto,
} from '../dto/time-to-fill.dto';

/**
 * F-026 BR-ANALYTICS-14/15 — Time-to-Fill + Fill Rate per course.
 *
 * Per course:
 *  - hoursToFill = (timestamp khi paid count đạt quota) − (course.openAt)
 *  - fillRate = paid / quota × 100
 *
 * BR-01: chỉ tính order paid.
 * BR-04: race draft loại.
 * BR-05: dedupe paid count theo athletes_id.
 *
 * Schema fallback: nếu race_course / registration_start_time / quota cột
 * không tồn tại → trả empty array để tránh throw lên user.
 */
@Injectable()
export class TimeToFillService {
  private readonly logger = new Logger(TimeToFillService.name);
  private readonly TTL = 3600;

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getTimeToFill(params: {
    period: PeriodKind;
    from?: string;
    to?: string;
    raceId?: string;
    courseId?: string;
  }): Promise<TimeToFillResponseDto> {
    const current = resolvePeriod({
      kind: params.period,
      from: params.from,
      to: params.to,
    });

    const scope =
      params.raceId != null
        ? ({ raceId: params.raceId } as const)
        : ('platform' as const);
    const cacheKey = buildMetricCacheKey(
      'time-to-fill',
      scope,
      params.courseId
        ? `${current.periodKey}|c:${params.courseId}`
        : current.periodKey,
    );

    const cached = await this.readCache<TimeToFillResponseDto>(cacheKey);
    if (cached) return cached;

    const courses = await this.computeCourses(
      current.fromIso,
      current.toIso,
      params.raceId,
      params.courseId,
    );

    const filled = courses
      .filter((c) => c.hoursToFill != null)
      .map((c) => c.hoursToFill ?? 0)
      .sort((a, b) => a - b);
    const median =
      filled.length === 0
        ? null
        : Math.round(filled[Math.floor(filled.length / 2)] * 10) / 10;

    const response: TimeToFillResponseDto = {
      courses,
      medianHoursToFill: median,
    };
    await this.writeCache(cacheKey, response);
    return response;
  }

  async aggregate(): Promise<void> {
    await this.getTimeToFill({ period: 'rolling12m' });
  }

  private async computeCourses(
    fromIso: string,
    toIso: string,
    raceId?: string,
    courseId?: string,
  ): Promise<TimeToFillCourseDto[]> {
    const raceFilter = raceId ? 'AND r.race_id = ?' : '';
    const courseFilter = courseId ? 'AND rc.id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));
    if (courseId) params.push(Number(courseId));

    // Lấy course + quota + paid count + filled timestamp.
    // Nếu race_course bảng không tồn tại → query throw → trả empty.
    const sql = `
      SELECT rc.id AS course_id,
             rc.name AS course_name,
             rc.quantity AS quota,
             r.race_id,
             r.title AS race_name,
             r.registration_start_time AS open_at,
             COUNT(DISTINCT CASE WHEN om.financial_status = 'paid'
                   THEN a.athletes_id END) AS paid_count,
             MAX(CASE WHEN om.financial_status = 'paid' THEN om.payment_on END)
                   AS last_paid_at
      FROM race_course rc
      JOIN races r ON r.race_id = rc.race_id
      LEFT JOIN athletes a ON a.race_id = r.race_id
      LEFT JOIN order_metadata om ON om.race_id = r.race_id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
        AND r.event_start_date >= ?
        AND r.event_start_date < ?
        ${raceFilter}
        ${courseFilter}
      GROUP BY rc.id, rc.name, rc.quantity, r.race_id, r.title, r.registration_start_time
      ORDER BY r.event_start_date DESC
    `;

    let rows: Array<{
      course_id: number;
      course_name: string;
      quota: number;
      race_id: number;
      race_name: string;
      open_at: string | Date | null;
      paid_count: number;
      last_paid_at: string | Date | null;
    }>;
    try {
      rows = await this.db.query(sql, params);
    } catch (e) {
      this.logger.warn(
        `Time-to-fill query fail (schema fallback): ${(e as Error).message}`,
      );
      return [];
    }

    return rows.map((r) => {
      const quota = Number(r.quota) || 0;
      const paid = Number(r.paid_count) || 0;
      const fillRate =
        quota > 0 ? Math.round((paid / quota) * 10000) / 100 : 0;
      const isFilled = quota > 0 && paid >= quota;

      const openAt = r.open_at ? new Date(r.open_at) : null;
      const filledAt = isFilled && r.last_paid_at ? new Date(r.last_paid_at) : null;

      let hoursToFill: number | null = null;
      if (openAt && filledAt) {
        const ms = filledAt.getTime() - openAt.getTime();
        if (ms > 0) hoursToFill = Math.round((ms / 3_600_000) * 10) / 10;
      }

      const status: 'OPEN' | 'FILLED' | 'EXPIRED' = isFilled ? 'FILLED' : 'OPEN';

      return {
        courseId: Number(r.course_id),
        courseName: r.course_name,
        raceId: Number(r.race_id),
        raceName: r.race_name,
        openAt: openAt ? openAt.toISOString() : null,
        filledAt: filledAt ? filledAt.toISOString() : null,
        hoursToFill,
        fillRate,
        status,
        quota,
        paid,
      };
    });
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const v = await this.redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch (e) {
      this.logger.warn(`redis get fail ${key}: ${e}`);
      return null;
    }
  }

  private async writeCache<T>(key: string, value: T): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.TTL);
    } catch (e) {
      this.logger.warn(`redis set fail ${key}: ${e}`);
    }
  }
}
