import { createHash, randomBytes } from 'crypto';

/**
 * Generate QR token (plain) cho TNV. Trả về:
 *  - `plain`: in ra QR code (client-side render)
 *  - `hash`: SHA-256 hex, lưu vào `ops_users.qr_token_hash`
 *
 * Scan flow: Crew đọc QR → gửi plain → service hash + `findOne({ qr_token_hash: hash })`.
 * Dùng `randomBytes(24)` → 32-char base64url, không đoán được từ user_id.
 */
export function genQrToken(): { plain: string; hash: string } {
  const plain = randomBytes(24).toString('base64url');
  const hash = hashQrToken(plain);
  return { plain, hash };
}

export function hashQrToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}
