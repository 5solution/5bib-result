import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';

/**
 * F-024 BR-CM-02: Contract number generation
 *
 * Format: `DD.MM/YYYY/HDDV/CLIENT-PROVIDER`
 *   DD.MM = ngày.tháng ký hợp đồng (signDate)
 *   YYYY  = năm signDate
 *   HDDV  = literal "Hợp Đồng Dịch Vụ"
 *   CLIENT  = abbreviated partner name (uppercase)
 *   PROVIDER = '5BIB' or '5SOLUTION'
 *
 * Sequence number: Redis INCR `contracts:sequence:<year>` — atomic, thread-safe.
 * Year reset: Jan 1 first request returns seq=1.
 *
 * 🛑 PAUSE-CODE-04 (Danny): edge cases:
 *   1. Backdate signDate (vd: ký 5/2026 nhưng nhập date 4/2026):
 *      → sequence theo `signDate.getFullYear()` (NOT current year). Ghi rõ trong test.
 *      → Rationale: contract_number reflect document date, không phải timestamp tạo record.
 *   2. 2 contract cùng date — Redis INCR atomic đảm bảo unique seq → 2 contract NO collision.
 *
 * Note: sequence không hiển thị trong contract number theo PRD format. Field
 * sequenceNumber dùng cho audit + ordering. Format giữ nguyên BR-CM-02.
 */
@Injectable()
export class ContractNumberService {
  private readonly logger = new Logger(ContractNumberService.name);

  constructor(
    // Spec unit-test instantiates với new ContractNumberService(mockRedis) trực tiếp
    // nên cần Optional fallback. Production wire qua RedisModule (@InjectRedis).
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  async generateNumber(
    signDate: Date,
    clientShortName: string,
    providerId: string,
  ): Promise<{ contractNumber: string; sequence: number }> {
    const dd = String(signDate.getDate()).padStart(2, '0');
    const mm = String(signDate.getMonth() + 1).padStart(2, '0');
    const yyyy = signDate.getFullYear();
    const sequence = await this.nextSequence(yyyy);
    const clean = (clientShortName || 'CLIENT')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 16) || 'CLIENT';
    const provider = providerId === '5SOLUTION' ? '5SOLUTION' : '5BIB';
    return {
      contractNumber: `${dd}.${mm}/${yyyy}/HDDV/${clean}-${provider}`,
      sequence,
    };
  }

  /** Atomic per-year sequence. Returns 1 on Jan 1 first call. */
  async nextSequence(year: number): Promise<number> {
    if (!this.redis) {
      // Fallback for unit tests / dev no-redis. Production luôn có Redis.
      this.logger.warn(
        `[contract-number] No Redis client — using random fallback (test/dev only)`,
      );
      return Math.floor(Math.random() * 1_000_000);
    }
    const key = `contracts:sequence:${year}`;
    return this.redis.incr(key);
  }

  /** Read current sequence without incrementing (for preview). */
  async peekSequence(year: number): Promise<number> {
    if (!this.redis) return 0;
    const v = await this.redis.get(`contracts:sequence:${year}`);
    return v ? parseInt(v, 10) : 0;
  }
}
