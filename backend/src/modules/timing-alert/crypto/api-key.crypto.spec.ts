import * as crypto from 'crypto';
import { ApiKeyCrypto } from './api-key.crypto';

/**
 * Test trực tiếp lớp ApiKeyCrypto với env mock. Constructor đọc env tại
 * runtime → set process.env trong beforeEach + dynamic import `env` module.
 */
describe('ApiKeyCrypto', () => {
  const validHexKey = crypto.randomBytes(32).toString('hex'); // 64 chars
  const validBase64Key = crypto.randomBytes(32).toString('base64'); // 44 chars

  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * Helper: re-import config + crypto fresh để pick up env mới.
   * `env` được build 1 lần từ Joi validation tại import → cần reset
   * module cache giữa tests.
   */
  function freshCrypto(envValue: string | undefined): ApiKeyCrypto {
    if (envValue === undefined) {
      delete process.env.TIMING_ALERT_ENCRYPTION_KEY;
    } else {
      process.env.TIMING_ALERT_ENCRYPTION_KEY = envValue;
    }
    jest.resetModules();
    // Re-require to pick up new env var
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ApiKeyCrypto: Fresh } = require('./api-key.crypto');
    return new Fresh();
  }

  describe('constructor — key validation', () => {
    it('accepts hex 64 chars', () => {
      expect(() => freshCrypto(validHexKey)).not.toThrow();
    });

    it('accepts base64 44 chars', () => {
      expect(() => freshCrypto(validBase64Key)).not.toThrow();
    });

    it('throws when env unset', () => {
      expect(() => freshCrypto(undefined)).toThrow(/TIMING_ALERT_ENCRYPTION_KEY missing/);
    });

    it('throws when env empty string', () => {
      expect(() => freshCrypto('')).toThrow(/TIMING_ALERT_ENCRYPTION_KEY missing/);
    });

    it('throws when key wrong length (16 bytes)', () => {
      const shortKey = crypto.randomBytes(16).toString('base64');
      expect(() => freshCrypto(shortKey)).toThrow(/32 bytes/);
    });

    it('throws when key garbage string', () => {
      expect(() => freshCrypto('not-a-valid-key!!!')).toThrow(/32 bytes/);
    });
  });

  describe('encrypt() / decrypt() roundtrip', () => {
    let svc: ApiKeyCrypto;

    beforeEach(() => {
      svc = freshCrypto(validHexKey);
    });

    it('roundtrip preserves plaintext', () => {
      const plaintext = 'LE2KXEYOAR6H4YLKGMSXPDT989IQ7VWA';
      const ct = svc.encrypt(plaintext);
      const pt = svc.decrypt(ct);
      expect(pt).toBe(plaintext);
    });

    it('encrypt produces different ciphertext each call (random IV)', () => {
      const plaintext = 'same-input';
      const ct1 = svc.encrypt(plaintext);
      const ct2 = svc.encrypt(plaintext);
      expect(ct1).not.toBe(ct2);
      // Both decrypt to same plaintext
      expect(svc.decrypt(ct1)).toBe(plaintext);
      expect(svc.decrypt(ct2)).toBe(plaintext);
    });

    it('ciphertext format is iv:tag:ct (3 base64 parts)', () => {
      const ct = svc.encrypt('test');
      const parts = ct.split(':');
      expect(parts).toHaveLength(3);
      // IV 12 bytes → base64 16 chars (no padding)
      const iv = Buffer.from(parts[0], 'base64');
      expect(iv.length).toBe(12);
      // authTag 16 bytes → base64 24 chars
      const tag = Buffer.from(parts[1], 'base64');
      expect(tag.length).toBe(16);
    });

    it('decrypt fails on tampered ciphertext (authTag mismatch)', () => {
      const ct = svc.encrypt('secret');
      const parts = ct.split(':');
      // Tamper ciphertext payload
      const tamperedCt = Buffer.from(parts[2], 'base64');
      tamperedCt[0] ^= 0xff;
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCt.toString('base64')}`;
      expect(() => svc.decrypt(tampered)).toThrow();
    });

    it('decrypt fails on wrong format (no colons)', () => {
      expect(() => svc.decrypt('not-encrypted-format')).toThrow(/invalid ciphertext format/);
    });

    it('decrypt fails on 2-part format', () => {
      expect(() => svc.decrypt('a:b')).toThrow(/3 parts/);
    });

    it('encrypt rejects empty string', () => {
      expect(() => svc.encrypt('')).toThrow(/non-empty/);
    });

    it('handles long API key (256 chars)', () => {
      const longKey = 'A'.repeat(256);
      const ct = svc.encrypt(longKey);
      expect(svc.decrypt(ct)).toBe(longKey);
    });

    it('handles non-ASCII plaintext (UTF-8)', () => {
      const vi = 'Tiếng Việt 🏃';
      const ct = svc.encrypt(vi);
      expect(svc.decrypt(ct)).toBe(vi);
    });
  });

  describe('static mask()', () => {
    it('masks 32-char API key showing 4+4 prefix/suffix', () => {
      const key = 'LE2KXEYOAR6H4YLKGMSXPDT989IQ7VWA';
      const masked = ApiKeyCrypto.mask(key);
      expect(masked).toBe('LE2K...7VWA (32 chars)');
    });

    it('returns *** for short keys', () => {
      expect(ApiKeyCrypto.mask('short')).toBe('***');
      expect(ApiKeyCrypto.mask('')).toBe('***');
    });

    it('handles edge case 9 chars (just over threshold)', () => {
      expect(ApiKeyCrypto.mask('123456789')).toBe('1234...6789 (9 chars)');
    });
  });

  describe('cross-instance compatibility', () => {
    it('ciphertext from instance A decrypts in instance B (same key)', () => {
      const a = freshCrypto(validHexKey);
      const ct = a.encrypt('shared-secret');
      const b = freshCrypto(validHexKey);
      expect(b.decrypt(ct)).toBe('shared-secret');
    });

    it('ciphertext from instance A FAILS decrypt in instance B (different key)', () => {
      const a = freshCrypto(validHexKey);
      const ct = a.encrypt('secret');
      const otherKey = crypto.randomBytes(32).toString('hex');
      const b = freshCrypto(otherKey);
      expect(() => b.decrypt(ct)).toThrow();
    });
  });
});
