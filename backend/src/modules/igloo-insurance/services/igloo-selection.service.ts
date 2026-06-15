import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isEligible, LegacyAthleteRow } from '../utils/igloo-helpers';

/**
 * FEATURE-085 — Tuyển chọn VĐV từ legacy MySQL (`'platform'` =
 * 5bib_platform_live, READ-ONLY). JOIN `athletes` + `athlete_subinfo` +
 * `races`. SQL hard-filter rẻ (deleted/dob/email/gender/CCCD/event upcoming);
 * `isEligible()` ở Node là source-of-truth cuối (gồm chuẩn hoá phone).
 *
 * BR-IGL-04/05 — eligibility + "phát sinh trong ngày" (created_on) + top-up.
 * Mọi query parameterized (`?`) — KHÔNG interpolate input (SEC).
 */
@Injectable()
export class IglooSelectionService {
  private readonly logger = new Logger(IglooSelectionService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
  ) {}

  private static readonly SELECT_COLS = `
    a.athletes_id        AS athletes_id,
    a.name               AS name,
    a.bib_number         AS bib_number,
    a.email              AS email,
    a.dob                AS dob,
    a.created_on         AS created_on,
    s.gender             AS gender,
    s.contact_phone      AS contact_phone,
    s.id_number          AS id_number,
    a.race_id            AS race_id,
    r.title              AS race_title,
    r.event_start_date   AS event_start_date,
    r.event_end_date     AS event_end_date,
    r.race_type          AS race_type,
    r.location           AS location,
    r.province           AS province,
    r.district           AS district`;

  private static readonly BASE_FROM = `
    FROM athletes a
    JOIN athlete_subinfo s ON a.subinfo_id = s.id
    JOIN races r ON a.race_id = r.race_id
    WHERE (a.deleted IS NULL OR a.deleted = 0)
      AND a.dob IS NOT NULL
      AND a.email IS NOT NULL AND a.email <> ''
      AND UPPER(s.gender) IN ('MALE','FEMALE')
      AND s.id_number REGEXP '^[0-9]{9,12}$'
      AND s.contact_phone IS NOT NULL AND s.contact_phone <> ''
      AND r.event_start_date IS NOT NULL
      AND r.event_start_date >= CURDATE()`;

  /** Danh sách VĐV eligible của 1 giải (admin manual select). */
  async findEligibleForRace(
    raceId: number,
    opts: { q?: string; page: number; pageSize: number },
  ): Promise<{ rows: LegacyAthleteRow[]; total: number }> {
    const params: unknown[] = [raceId];
    let extra = ' AND a.race_id = ?';
    const q = (opts.q ?? '').trim();
    if (q) {
      extra += ' AND (a.name LIKE ? OR a.bib_number LIKE ? OR s.id_number LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const offset = (opts.page - 1) * opts.pageSize;
    const rows = (await this.db.query(
      `SELECT ${IglooSelectionService.SELECT_COLS}
       ${IglooSelectionService.BASE_FROM}${extra}
       ORDER BY a.created_on DESC
       LIMIT ? OFFSET ?`,
      [...params, opts.pageSize, offset],
    )) as LegacyAthleteRow[];

    const countRes = (await this.db.query(
      `SELECT COUNT(*) AS n ${IglooSelectionService.BASE_FROM}${extra}`,
      params,
    )) as Array<{ n: number | string }>;
    const total = Number(countRes[0]?.n ?? 0);

    const today = new Date();
    return { rows: rows.filter((r) => isEligible(r, today)), total };
  }

  /**
   * Cron daily — chọn VĐV "phát sinh trong ngày" (created_on = hôm nay) trước,
   * thiếu thì top-up random từ kho (BR-IGL-05). Trả nhiều hơn `limit` (buffer)
   * để orchestrator lọc trùng-đơn rồi cắt đúng số.
   */
  async findNewTodayCandidates(limit: number): Promise<LegacyAthleteRow[]> {
    const rows = (await this.db.query(
      `SELECT ${IglooSelectionService.SELECT_COLS}
       ${IglooSelectionService.BASE_FROM}
         AND DATE(a.created_on) = CURDATE()
       ORDER BY a.created_on DESC
       LIMIT ?`,
      [limit],
    )) as LegacyAthleteRow[];
    const today = new Date();
    return rows.filter((r) => isEligible(r, today));
  }

  /** Kho random để top-up (BR-IGL-05). */
  async findPoolCandidates(limit: number): Promise<LegacyAthleteRow[]> {
    const rows = (await this.db.query(
      `SELECT ${IglooSelectionService.SELECT_COLS}
       ${IglooSelectionService.BASE_FROM}
       ORDER BY RAND()
       LIMIT ?`,
      [limit],
    )) as LegacyAthleteRow[];
    const today = new Date();
    return rows.filter((r) => isEligible(r, today));
  }

  /** Lấy 1 hàng cụ thể (manual create — build payload). */
  async findRow(
    athletesId: number,
    raceId: number,
  ): Promise<LegacyAthleteRow | null> {
    const rows = (await this.db.query(
      `SELECT ${IglooSelectionService.SELECT_COLS}
       ${IglooSelectionService.BASE_FROM}
         AND a.athletes_id = ? AND a.race_id = ?
       LIMIT 1`,
      [athletesId, raceId],
    )) as LegacyAthleteRow[];
    const r = rows[0];
    if (!r) return null;
    return isEligible(r, new Date()) ? r : null;
  }

  /** Giải sắp diễn ra (dropdown). */
  async listUpcomingRaces(): Promise<
    Array<{
      mysqlRaceId: number;
      title: string | null;
      eventStartDate: Date | null;
      eventEndDate: Date | null;
      raceType: string | null;
    }>
  > {
    const rows = (await this.db.query(
      `SELECT DISTINCT r.race_id AS mysqlRaceId, r.title AS title,
              r.event_start_date AS eventStartDate, r.event_end_date AS eventEndDate,
              r.race_type AS raceType
       FROM races r
       JOIN athletes a ON a.race_id = r.race_id
       WHERE r.event_start_date IS NOT NULL AND r.event_start_date >= CURDATE()
       ORDER BY r.event_start_date ASC
       LIMIT 100`,
    )) as Array<{
      mysqlRaceId: number;
      title: string | null;
      eventStartDate: Date | null;
      eventEndDate: Date | null;
      raceType: string | null;
    }>;
    return rows;
  }
}
