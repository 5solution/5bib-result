import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** 1 VĐV đã xác nhận BIB (đọc read-only từ legacy `athletes` + `athlete_subinfo`). */
export interface ConfirmedAthleteRow {
  athletes_id: number;
  race_id: number;
  name: string | null;
  bib_number: string | null;
  email: string | null;
  /** subinfo — token động + fallback tên khi athletes.name rỗng. */
  club: string | null;
  name_on_bib: string | null;
  first_name: string | null;
  last_name: string | null;
}

/**
 * FEATURE-091 — quét VĐV "đã xác nhận BIB" từ legacy MySQL (`'platform'` =
 * 5bib_platform_live, **READ-ONLY**). KHÔNG đụng code/DB legacy: chỉ SELECT.
 *
 * BR-01 — "đã xác nhận" khi cả 3 cột `athletes` đều có giá trị:
 *   - `bib_number` (số BIB đã gán),
 *   - `rolling_bib_last_time` (thời điểm quay BIB),
 *   - `bib_image` (URL ảnh BIB — chưa xác nhận = NULL hoặc rỗng).
 *
 * MỌI query parameterized (`?`) — KHÔNG interpolate input (SEC, port F-085).
 */
@Injectable()
export class BibPassScannerService {
  private readonly logger = new Logger(BibPassScannerService.name);

  constructor(@InjectDataSource('platform') private readonly db: DataSource) {}

  /** Cột trả về (token động cho khung). */
  private static readonly SELECT_COLS = `
    a.athletes_id   AS athletes_id,
    a.race_id       AS race_id,
    a.name          AS name,
    a.bib_number    AS bib_number,
    a.email         AS email,
    s.club          AS club,
    s.name_on_bib   AS name_on_bib,
    s.first_name    AS first_name,
    s.last_name     AS last_name`;

  /** FROM + JOIN subinfo (LEFT — subinfo có thể null) + điều kiện confirmed (BR-01). */
  private static readonly BASE_FROM = `
    FROM athletes a
    LEFT JOIN athlete_subinfo s ON a.subinfo_id = s.id
    WHERE (a.deleted IS NULL OR a.deleted = 0)
      AND a.bib_number IS NOT NULL AND a.bib_number <> ''
      AND a.rolling_bib_last_time IS NOT NULL
      AND a.bib_image IS NOT NULL AND a.bib_image <> ''`;

  /** Giải có VĐV đã xác nhận BIB (dropdown admin). */
  async listRacesWithConfirmed(): Promise<
    Array<{ raceId: number; title: string | null; confirmedCount: number }>
  > {
    const rows = (await this.db.query(
      `SELECT a.race_id AS raceId, r.title AS title, COUNT(*) AS confirmedCount
       FROM athletes a
       JOIN races r ON a.race_id = r.race_id
       WHERE (a.deleted IS NULL OR a.deleted = 0)
         AND a.bib_number IS NOT NULL AND a.bib_number <> ''
         AND a.rolling_bib_last_time IS NOT NULL
         AND a.bib_image IS NOT NULL AND a.bib_image <> ''
       GROUP BY a.race_id, r.title
       HAVING confirmedCount > 0
       ORDER BY a.race_id DESC
       LIMIT 200`,
    )) as Array<{ raceId: number | string; title: string | null; confirmedCount: number | string }>;
    return rows.map((r) => ({
      raceId: Number(r.raceId),
      title: r.title,
      confirmedCount: Number(r.confirmedCount),
    }));
  }

  async countConfirmed(raceId: number): Promise<number> {
    const res = (await this.db.query(
      `SELECT COUNT(*) AS n ${BibPassScannerService.BASE_FROM} AND a.race_id = ?`,
      [raceId],
    )) as Array<{ n: number | string }>;
    return Number(res[0]?.n ?? 0);
  }

  /**
   * Toàn bộ VĐV đã xác nhận của 1 giải (dùng cho batch send — caller anti-join
   * với ledger Mongo rồi cắt theo limit). Cap cứng để tránh load quá lớn.
   */
  async findConfirmed(raceId: number, cap = 10000): Promise<ConfirmedAthleteRow[]> {
    const rows = (await this.db.query(
      `SELECT ${BibPassScannerService.SELECT_COLS}
       ${BibPassScannerService.BASE_FROM} AND a.race_id = ?
       ORDER BY a.rolling_bib_last_time ASC
       LIMIT ?`,
      [raceId, cap],
    )) as ConfirmedAthleteRow[];
    return rows.map(this.normalize);
  }

  /** Trang danh sách VĐV đã xác nhận (admin xem) + tổng. */
  async listConfirmedPaged(
    raceId: number,
    opts: { q?: string; page: number; pageSize: number },
  ): Promise<{ rows: ConfirmedAthleteRow[]; total: number }> {
    const params: unknown[] = [raceId];
    let extra = '';
    // Cap độ dài + escape ký tự đặc biệt LIKE (\ % _) → tránh wildcard injection
    // (parameterized nên KHÔNG phải SQLi, nhưng `%` lọt vào sẽ match tất cả).
    const q = (opts.q ?? '').trim().slice(0, 100).replace(/[\\%_]/g, '\\$&');
    if (q) {
      extra = ' AND (a.name LIKE ? OR a.bib_number LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like);
    }
    const offset = (opts.page - 1) * opts.pageSize;
    const rows = (await this.db.query(
      `SELECT ${BibPassScannerService.SELECT_COLS}
       ${BibPassScannerService.BASE_FROM} AND a.race_id = ?${extra}
       ORDER BY a.rolling_bib_last_time DESC
       LIMIT ? OFFSET ?`,
      [...params, opts.pageSize, offset],
    )) as ConfirmedAthleteRow[];
    const countRes = (await this.db.query(
      `SELECT COUNT(*) AS n ${BibPassScannerService.BASE_FROM} AND a.race_id = ?${extra}`,
      params,
    )) as Array<{ n: number | string }>;
    return { rows: rows.map(this.normalize), total: Number(countRes[0]?.n ?? 0) };
  }

  /** 1 VĐV cụ thể đã xác nhận (test-send với dữ liệu thật). */
  async findConfirmedOne(
    raceId: number,
    athletesId: number,
  ): Promise<ConfirmedAthleteRow | null> {
    const rows = (await this.db.query(
      `SELECT ${BibPassScannerService.SELECT_COLS}
       ${BibPassScannerService.BASE_FROM} AND a.race_id = ? AND a.athletes_id = ?
       LIMIT 1`,
      [raceId, athletesId],
    )) as ConfirmedAthleteRow[];
    return rows[0] ? this.normalize(rows[0]) : null;
  }

  private normalize(r: ConfirmedAthleteRow): ConfirmedAthleteRow {
    return {
      athletes_id: Number(r.athletes_id),
      race_id: Number(r.race_id),
      name: r.name ?? null,
      bib_number: r.bib_number ?? null,
      email: r.email ?? null,
      club: r.club ?? null,
      name_on_bib: r.name_on_bib ?? null,
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
    };
  }
}
