import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { env } from '../../../config';

/**
 * AES-256-GCM symmetric encryption cho RaceResult API keys lưu Mongo.
 *
 * Format ciphertext: `<iv>:<authTag>:<ciphertext>` (3 phần base64 tách bằng `:`).
 * - IV: 12 bytes (GCM standard, random per encrypt)
 * - authTag: 16 bytes (GCM authenticator — verify integrity khi decrypt)
 * - ciphertext: variable length
 *
 * Key 32 bytes (256 bit) — env `TIMING_ALERT_ENCRYPTION_KEY` accept format:
 *   - 64-char hex string: `crypto.randomBytes(32).toString('hex')`
 *   - 44-char base64 string: `crypto.randomBytes(32).toString('base64')`
 *
 * **Security invariants:**
 * - IV NEVER reused (catastrophic for GCM — same IV + same key = nonce reuse
 *   attack có thể recover plaintext). Random per encrypt = OK.
 * - authTag verify trong decrypt — tampering throws DecryptionError.
 * - Key length validate ở constructor — 32 bytes raw mới qua. Sai length
 *   → throw rõ để admin fix env, KHÔNG silent fail.
 */
@Injectable()
export class ApiKeyCrypto {
  private readonly logger = new Logger(ApiKeyCrypto.name);
  private readonly key: Buffer;
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_BYTES = 12;
  private static readonly KEY_BYTES = 32;

  constructor() {
    const raw = env.timingAlert.encryptionKey;
    if (!raw) {
      throw new InternalServerErrorException(
        'TIMING_ALERT_ENCRYPTION_KEY missing. Set 32-byte key as hex (64 chars) ' +
          'hoặc base64 (44 chars). Generate: `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"`',
      );
    }

    // Detect format: hex (64 chars, only [0-9a-f]) hoặc base64 (44 chars, =
    // padding cuối). Try hex trước vì hex dễ verify hơn.
    let buffer: Buffer | null = null;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      buffer = Buffer.from(raw, 'hex');
    } else {
      try {
        const b = Buffer.from(raw, 'base64');
        if (b.length === ApiKeyCrypto.KEY_BYTES) buffer = b;
      } catch {
        // fall through
      }
    }

    if (!buffer || buffer.length !== ApiKeyCrypto.KEY_BYTES) {
      throw new InternalServerErrorException(
        `TIMING_ALERT_ENCRYPTION_KEY phải = 32 bytes (got ${buffer?.length ?? 'invalid'} bytes). ` +
          'Hex 64 chars hoặc base64 44 chars.',
      );
    }

    this.key = buffer;
  }

  /**
   * Encrypt plaintext API key. Returns string `<iv>:<tag>:<ct>` ready để
   * lưu Mongo string field.
   */
  encrypt(plaintext: string): string {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      throw new Error('encrypt: plaintext must be non-empty string');
    }
    const iv = crypto.randomBytes(ApiKeyCrypto.IV_BYTES);
    const cipher = crypto.createCipheriv(ApiKeyCrypto.ALGORITHM, this.key, iv);
    const ct = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  /**
   * Decrypt ciphertext format `<iv>:<tag>:<ct>`. Throws nếu format sai
   * hoặc authTag không match (tampering / wrong key).
   */
  decrypt(encrypted: string): string {
    if (typeof encrypted !== 'string' || !encrypted.includes(':')) {
      throw new Error('decrypt: invalid ciphertext format (expected iv:tag:ct)');
    }
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error(
        `decrypt: invalid format — expected 3 parts separated by ':', got ${parts.length}`,
      );
    }
    const [ivB64, tagB64, ctB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');

    if (iv.length !== ApiKeyCrypto.IV_BYTES) {
      throw new Error(`decrypt: invalid IV length ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(
      ApiKeyCrypto.ALGORITHM,
      this.key,
      iv,
    );
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  }

  /**
   * Mask plaintext API key cho display admin UI / log. KHÔNG decrypt cho
   * client — only show 4 prefix + 4 suffix + count.
   * VD: `LE2K...7VWA (32 chars)`
   */
  static mask(plaintext: string): string {
    if (!plaintext || plaintext.length <= 8) return '***';
    return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)} (${plaintext.length} chars)`;
  }
}
