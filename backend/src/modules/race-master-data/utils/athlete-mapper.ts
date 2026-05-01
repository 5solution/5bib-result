import { AthleteReadonly } from '../entities/athlete-readonly.entity';
import { RaceAthlete } from '../schemas/race-athlete.schema';
import { RaceAthletePublicDto } from '../dto/race-athlete-public.dto';
import { RaceAthleteAdminDto } from '../dto/race-athlete-admin.dto';

/**
 * Map MySQL legacy athlete (with relations loaded) → MongoDB schema doc.
 * KHÔNG include PII fields — caller decide khi nào cần PII (admin endpoint
 * load thêm bằng `select('+email +contact_phone +id_number')`).
 *
 * Course name resolution paths (giữ pattern từ chip-cache.service legacy):
 *   1. PRIMARY: athlete → subinfo → order_line_item → ticket_type → race_course
 *   2. FALLBACK: athlete → code → race_course (race import qua code, no order)
 */
export function mapMysqlAthleteToSchema(
  raceId: number,
  a: AthleteReadonly,
): Partial<RaceAthlete> & { mysql_race_id: number; athletes_id: number } {
  const bibName = a.subinfo?.name_on_bib?.trim() || null;
  const fullName = a.name?.trim() || null;
  const displayName = bibName ?? fullName;

  // Course resolution
  const courseFromOrder = a.subinfo?.orderLineItem?.ticketType?.raceCourse ?? null;
  const courseFromCode = a.code?.raceCourse ?? null;
  const course = courseFromOrder ?? courseFromCode;

  const ticketTypeId = a.subinfo?.orderLineItem?.ticket_type_id ?? null;

  return {
    mysql_race_id: raceId,
    athletes_id: Number(a.athletes_id),
    bib_number: a.bib_number?.trim() || null,
    display_name: displayName,
    bib_name: bibName,
    full_name: fullName,
    gender: normalizeGender(a.subinfo?.gender ?? null),
    course_id: course?.id ? Number(course.id) : null,
    course_name: course?.name ?? null,
    course_distance: course?.distance ?? null,
    club: a.subinfo?.club?.trim() || null,
    ticket_type_id: ticketTypeId ? Number(ticketTypeId) : null,
    // Vật phẩm racekit từ subinfo.achievements (free-form text). Trim
    // null-safe → empty string sau trim coi như null (FE hiện '—').
    items: a.subinfo?.achievements?.trim() || null,
    last_status: a.last_status ?? null,
    racekit_received: Number(a.racekit_recieved ?? 0) === 1,
    racekit_received_at: a.racekit_recieved_time ?? null,
    source: 'mysql_platform',
    legacy_modified_on: a.modified_on ?? null,
    synced_at: new Date(),
  };
}

/**
 * Strict allowlist: KHÔNG có email/phone/cccd. Type system enforce qua
 * RaceAthletePublicDto return type.
 */
export function toPublicView(doc: RaceAthlete): RaceAthletePublicDto {
  return {
    mysql_race_id: doc.mysql_race_id,
    athletes_id: doc.athletes_id,
    bib_number: doc.bib_number,
    display_name: doc.display_name,
    bib_name: doc.bib_name,
    full_name: doc.full_name,
    gender: doc.gender,
    course_id: doc.course_id,
    course_name: doc.course_name,
    course_distance: doc.course_distance,
    club: doc.club,
    items: doc.items,
    last_status: doc.last_status,
    racekit_received: doc.racekit_received,
    racekit_received_at: doc.racekit_received_at,
  };
}

/** Admin view bao gồm PII. Caller PHẢI load doc với select PII (xem service). */
export function toAdminView(doc: RaceAthlete): RaceAthleteAdminDto {
  return {
    ...toPublicView(doc),
    email: doc.email ?? null,
    contact_phone: doc.contact_phone ?? null,
    id_number: doc.id_number ?? null,
    source: doc.source,
    legacy_modified_on: doc.legacy_modified_on,
    synced_at: doc.synced_at,
    sync_version: doc.sync_version,
  };
}

/**
 * Normalize gender từ MySQL (varchar 16) sang label tiếng Việt.
 * MySQL có thể chứa: 'MALE' | 'FEMALE' | 'OTHER' | 'M' | 'F' | null.
 */
export function normalizeGender(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'MALE' || v === 'M' || v === 'NAM') return 'Nam';
  if (v === 'FEMALE' || v === 'F' || v === 'NỮ' || v === 'NU') return 'Nữ';
  if (v === 'OTHER' || v === 'O') return 'Khác';
  return raw;
}
