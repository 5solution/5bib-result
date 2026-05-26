import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { stripCompanyPrefix } from '../utils/strip-company-prefix.util';

/**
 * F-024 BR-CM-02 + FEATURE-066: Contract number generation
 *
 * Format: `DD.MM/YYYY/HDDV/CLIENT-PROVIDER[-N]`
 *   DD.MM     = ngày.tháng ký hợp đồng (signDate)
 *   YYYY      = năm signDate (PAUSE-CODE-04 backdate uses signDate.year)
 *   HDDV      = literal "Hợp Đồng Dịch Vụ"
 *   CLIENT    = abbreviated partner name (uppercase, ≤16 chars, A-Z 0-9)
 *   PROVIDER  = '5BIB' or '5SOLUTION'
 *   -N        = sequence suffix khi seq ≥ 2 (F-024 BUG-002 fix)
 *
 * FEATURE-066 changes:
 *   1. `generateNumber()` accept optional `partnerShortName` (admin override).
 *      Priority: shortName non-empty > stripCompanyPrefix(entityName) > 'CLIENT'.
 *   2. Sequence key changed từ `contracts:sequence:<year>` → `contracts:sequence:<year>:<clientShortName>`.
 *      Mỗi (year, clientShortName) atomic INCR riêng → HĐ đầu năm của mỗi client luôn seq=1.
 *   3. Backward compat: legacy 2-arg / 3-arg call sites vẫn work — overload signature.
 *
 * 🛑 PAUSE-CODE-04 (Danny) — F-024 edge cases preserved:
 *   1. Backdate signDate → sequence theo `signDate.getFullYear()` (NOT current year).
 *   2. 2 contracts cùng date — Redis INCR atomic đảm bảo unique seq.
 *
 * 🛑 BR-66-09 forward-only: HĐ tạo trước F-066 deploy KHÔNG bị regenerate
 *   contractNumber. Service chỉ generate khi caller invoke với DRAFT contract.
 */

export interface GenerateNumberArgs {
  signDate: Date;
  /** Optional admin-override shortName từ Partner.shortName. Khi non-empty + valid → ưu tiên cao nhất. */
  partnerShortName?: string | null;
  /** Tên pháp nhân đầy đủ (fallback nếu shortName empty). */
  entityName?: string | null;
  /** '5BIB' | '5SOLUTION'. */
  providerId: string;
}

export interface GenerateNumberResult {
  contractNumber: string;
  sequence: number;
  /** Token CLIENT đã sanitize — exposed for caller logging/preview. */
  clientToken: string;
  /** 'partnerShortName' | 'entityName_stripped' | 'fallback' — for audit log (BR-66-15). */
  source: 'partnerShortName' | 'entityName_stripped' | 'fallback';
}

@Injectable()
export class ContractNumberService {
  private readonly logger = new Logger(ContractNumberService.name);

  constructor(
    // Spec unit-test instantiates với new ContractNumberService(mockRedis) trực tiếp
    // nên cần Optional fallback. Production wire qua RedisModule (@InjectRedis).
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  /**
   * F-066 overload — preferred signature với args object.
   *
   * @example
   *   await svc.generateNumber({
   *     signDate: new Date('2026-05-15'),
   *     partnerShortName: 'TAM',           // override (highest priority)
   *     entityName: 'CÔNG TY CỔ PHẦN TÂM AN MEDIA',
   *     providerId: '5BIB',
   *   });
   *   // → { contractNumber: '15.05/2026/HDDV/TAM-5BIB', sequence: 1, clientToken: 'TAM', source: 'partnerShortName' }
   */
  async generateNumber(args: GenerateNumberArgs): Promise<GenerateNumberResult>;
  /**
   * F-024 legacy overload — 3-positional (signDate, clientShortName, providerId).
   * Backward compat cho legacy call sites + tests F-024.
   */
  async generateNumber(
    signDate: Date,
    clientShortName: string,
    providerId: string,
  ): Promise<GenerateNumberResult>;
  async generateNumber(
    a: Date | GenerateNumberArgs,
    b?: string,
    c?: string,
  ): Promise<GenerateNumberResult> {
    // Normalize overload args
    const args: GenerateNumberArgs =
      a instanceof Date
        ? {
            signDate: a,
            partnerShortName: b,
            entityName: undefined,
            providerId: c ?? '5BIB',
          }
        : a;

    const { signDate, partnerShortName, entityName, providerId } = args;

    const dd = String(signDate.getDate()).padStart(2, '0');
    const mm = String(signDate.getMonth() + 1).padStart(2, '0');
    const yyyy = signDate.getFullYear();

    // Resolve CLIENT token theo BR-66-02 priority
    const { token: clientToken, source } = this.resolveClientToken(
      partnerShortName,
      entityName,
    );

    const sequence = await this.nextSequence(yyyy, clientToken);
    const provider = providerId === '5SOLUTION' ? '5SOLUTION' : '5BIB';
    // F-024 BUG-002 fix — seq > 1 → append "-N" suffix.
    const seqSuffix = sequence > 1 ? `-${sequence}` : '';
    const contractNumber = `${dd}.${mm}/${yyyy}/HDDV/${clientToken}-${provider}${seqSuffix}`;

    // BR-66-15 structured audit log
    this.logger.warn({
      event: 'contract_number_generated',
      year: yyyy,
      clientToken,
      sequence,
      source,
      providerId: provider,
    });

    return { contractNumber, sequence, clientToken, source };
  }

  /**
   * BR-66-02 / BR-66-03: Resolve CLIENT token với 2-tier priority.
   *
   * Priority:
   *   1. `partnerShortName` nếu non-empty + match `^[A-Z0-9]{1,16}$` sau sanitize
   *   2. stripCompanyPrefix(entityName) → sanitize → uppercase → slice 16
   *   3. Fallback constant 'CLIENT' (KHÔNG throw)
   *
   * @returns token (đã sanitize ≤16 alphanumeric uppercase) + source label
   */
  private resolveClientToken(
    partnerShortName?: string | null,
    entityName?: string | null,
  ): { token: string; source: 'partnerShortName' | 'entityName_stripped' | 'fallback' } {
    // Tier 1: partnerShortName override
    if (partnerShortName && partnerShortName.trim().length > 0) {
      const overrideToken = sanitizeToken(partnerShortName);
      if (overrideToken.length > 0) {
        return { token: overrideToken, source: 'partnerShortName' };
      }
    }
    // Tier 2: strip prefix entityName
    if (entityName && entityName.trim().length > 0) {
      const stripped = stripCompanyPrefix(entityName);
      const strippedToken = sanitizeToken(stripped);
      if (strippedToken.length > 0) {
        return { token: strippedToken, source: 'entityName_stripped' };
      }
    }
    // Tier 3: fallback constant
    return { token: 'CLIENT', source: 'fallback' };
  }

  /**
   * BR-66-05 / BR-66-06: Atomic per-(year, clientShortName) sequence.
   *
   * @param year số năm (vd 2026) — phải dùng `signDate.getFullYear()` (PAUSE-CODE-04 backdate)
   * @param clientShortName token CLIENT đã sanitize. Required cho F-066 per-client isolation.
   *   Legacy callers truyền undefined → fallback global key (giữ backward compat F-024).
   * @returns sequence ≥ 1 (Redis INCR semantics: 1 trên Jan 1 đầu năm cho client mới)
   */
  async nextSequence(year: number, clientShortName?: string): Promise<number> {
    if (!this.redis) {
      // Fallback for unit tests / dev no-redis. Production luôn có Redis.
      this.logger.warn(
        `[contract-number] No Redis client — using random fallback (test/dev only)`,
      );
      return Math.floor(Math.random() * 1_000_000);
    }
    const key = this.sequenceKey(year, clientShortName);
    return this.redis.incr(key);
  }

  /** Read current sequence without incrementing (for preview — BR-66-13). */
  async peekSequence(year: number, clientShortName?: string): Promise<number> {
    if (!this.redis) return 0;
    const v = await this.redis.get(this.sequenceKey(year, clientShortName));
    return v ? parseInt(v, 10) : 0;
  }

  /**
   * Build Redis key. F-066 per-(year, client) format khi clientShortName provided,
   * legacy `contracts:sequence:<year>` khi undefined (backward compat).
   */
  private sequenceKey(year: number, clientShortName?: string): string {
    return clientShortName && clientShortName.length > 0
      ? `contracts:sequence:${year}:${clientShortName}`
      : `contracts:sequence:${year}`;
  }
}

/**
 * Sanitize a candidate CLIENT token: ASCII uppercase, strip non-alphanumeric, slice 16.
 * Returns empty string nếu input rỗng/invalid → caller fallback chain (BR-66-03).
 */
function sanitizeToken(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}
