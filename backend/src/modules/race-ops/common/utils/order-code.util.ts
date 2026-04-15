/**
 * Generate supply order code: "ORD-{team_code}-{yyyymmdd}-{seq}".
 * Seq là số random 4-digit để tránh race condition ở service layer;
 * service có thể dùng counter collection nếu cần deterministic.
 */
export function genOrderCode(teamCode: string, now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(1000 + Math.random() * 9000));
  const code = teamCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'TEAM';
  return `ORD-${code}-${y}${m}${d}-${seq}`;
}

/**
 * Slugify tên team (VI) thành code uppercase.
 *   "Trạm Y Tế" → "TRAM_Y_TE"
 *   "ANĐC (core)" → "ANDC_CORE"
 */
export function slugifyTeamCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}
