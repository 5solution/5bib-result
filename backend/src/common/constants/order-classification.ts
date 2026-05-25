/**
 * FEATURE-061 — Shared order classification constants & helpers.
 *
 * Single source of truth cho 3 module:
 *   - reconciliation/services/reconciliation-query.service.ts (categorize)
 *   - finance/services/fee.service.ts (computeFeeForOrdersAggregate +
 *     computeSelfFee SQL CASE)
 *   - analytics + dashboard SQL pull payment_ref column
 *
 * Bug history:
 *   F-016 v1.6.5 extend FIVE_BIB_CATEGORIES to 6 categories (added
 *     GROUP_BUY, GROUP_BUY_FIXED, CODE_TRANSFER).
 *   F-061 v1.9.5 unify SPLIT_BY_PAYMENT_REF logic — extend Set thêm
 *     ORDINARY + CHANGE_COURSE. Drop BR-03 "ORDINARY pass-through 5BIB
 *     regardless" special-case → 19 race MOU đặc biệt giờ classify đúng
 *     MANUAL khi payment_ref empty.
 *
 * PAUSE-61-01 = A — All 6 categories uniformly split by payment_ref:
 *   - Truthy payment_ref (≠ null/undefined/empty/whitespace) → 5BIB GMV path.
 *   - Falsy payment_ref → MANUAL semantic (organizer self-collect, 5BIB
 *     charge per-ticket manual fee).
 * PAUSE-61-BA-A = defensive whitespace trim → fallback MANUAL safer.
 */

/**
 * 6 categories eligible for 5BIB platform fee classification.
 * MANUAL stands alone — không nằm trong set này (đã được dedicated MANUAL
 * branch trong categorize logic).
 */
export const FIVE_BIB_CATEGORIES: readonly string[] = [
  'ORDINARY',
  'PERSONAL_GROUP',
  'CHANGE_COURSE',
  'GROUP_BUY',
  'GROUP_BUY_FIXED',
  'CODE_TRANSFER',
] as const;

/**
 * Categories ALL split by `payment_ref` presence (F-061 BR-61-01).
 *
 * = FIVE_BIB_CATEGORIES (sau F-061 v1.9.5 unify — 1 source of truth).
 * Trước F-061: chỉ 4 categories trong set này (PERSONAL_GROUP + 3 group
 * categories). ORDINARY + CHANGE_COURSE bị treat đặc biệt = "pass-through
 * 5BIB regardless of payment_ref" → bug 19 race MOU.
 *
 * Sau F-061: cả 6 → behavior:
 *   - payment_ref truthy → 5BIB GMV path
 *   - payment_ref falsy → MANUAL semantic (intentional, organizer self-collect)
 */
export const SPLIT_BY_PAYMENT_REF = new Set<string>([
  'ORDINARY',
  'PERSONAL_GROUP',
  'CHANGE_COURSE',
  'GROUP_BUY',
  'GROUP_BUY_FIXED',
  'CODE_TRANSFER',
]);

/**
 * F-061 BR-61-03 + PAUSE-61-BA-A — Defensive truthiness check.
 *
 * Returns true (empty/missing payment ref) cho:
 *   - null / undefined
 *   - empty string ''
 *   - whitespace only '   ' (PAUSE-61-BA-A defensive — accidental data
 *     entry → fallback MANUAL safer; Sales Admin có WARNING preflight catch
 *     case này)
 *
 * Returns false cho mọi non-empty trimmed string.
 *
 * @example
 * isPaymentRefEmpty(null) === true
 * isPaymentRefEmpty('') === true
 * isPaymentRefEmpty('   ') === true
 * isPaymentRefEmpty('VNPAY-123') === false
 */
export function isPaymentRefEmpty(
  ref: string | null | undefined,
): boolean {
  if (ref === null || ref === undefined) return true;
  if (typeof ref !== 'string') return true;
  return ref.trim() === '';
}

/**
 * F-061 BR-61-06 — SQL fragment cho `computeSelfFee` raw SQL CASE statement.
 *
 * Helper builds `IN (...)` clause cho FIVE_BIB_CATEGORIES quoted with
 * literal single quotes (safe — hardcoded list, no SQL injection vector).
 *
 * @example
 * FIVE_BIB_SQL_LIST === "'ORDINARY','PERSONAL_GROUP','CHANGE_COURSE','GROUP_BUY','GROUP_BUY_FIXED','CODE_TRANSFER'"
 */
export const FIVE_BIB_SQL_LIST = FIVE_BIB_CATEGORIES.map(
  (c) => `'${c}'`,
).join(',');

/**
 * F-061.1 hotfix — Pattern B FREE detection helper.
 *
 * QC re-audit post v1.9.5 phát hiện F-061 over-charge ~32M VND MANUAL fee ảo
 * cho 25/29 race ORDINARY no_ref. Distribution:
 *   - Pattern A (MOU thu hộ, total_price > 0): organizer thu ngoài 5BIB
 *     → ĐÚNG là MANUAL semantic, charge fee đúng.
 *   - Pattern B (Promo 100% FREE, total_price = 0): VĐV không trả tiền
 *     (discound_code_id giảm 100%) → organizer KHÔNG thu, 5BIB cũng KHÔNG
 *     được charge MANUAL fee ảo trên đơn FREE này.
 *
 * Returns true cho free promo order (total_price = 0 after discount) — caller
 * SKIP MANUAL fee compute hoàn toàn (KHÔNG count MANUAL, KHÔNG count 5BIB GMV).
 *
 * @example
 * isFreePromoOrder(0) === true
 * isFreePromoOrder('0') === true
 * isFreePromoOrder(null) === false   // unknown → fail-safe NOT free
 * isFreePromoOrder(500000) === false
 */
export function isFreePromoOrder(
  totalPrice: number | string | null | undefined,
): boolean {
  if (totalPrice == null) return false;
  const n = Number(totalPrice);
  if (!Number.isFinite(n)) return false;
  return n === 0;
}
