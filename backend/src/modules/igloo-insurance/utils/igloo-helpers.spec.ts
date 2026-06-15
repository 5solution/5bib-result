import {
  buildIglooPayload,
  buildPartnerRefId,
  computeCoverage,
  computePremium,
  derivePackageCode,
  isEligible,
  isValidIdCard,
  normalizeGender,
  normalizePhone,
  toYmd,
  LegacyAthleteRow,
} from './igloo-helpers';

/** Base eligible row — override từng case. */
function row(overrides: Partial<LegacyAthleteRow> = {}): LegacyAthleteRow {
  return {
    athletes_id: 101,
    name: 'Nguyễn Văn A',
    bib_number: '1234',
    email: 'a@example.com',
    dob: '1992-06-27',
    created_on: '2026-06-15',
    gender: 'MALE',
    contact_phone: '0901234567',
    id_number: '092124584349',
    race_id: 220,
    race_title: 'LÀO CAI MARATHON 2026',
    event_start_date: '2026-07-10',
    event_end_date: '2026-07-12',
    race_type: 'TRAIL_RACE',
    location: '435/10 Nguyễn Du',
    province: 'TP. Hồ Chí Minh',
    district: 'Thủ Đức',
    course_distance: '21KM',
    ...overrides,
  };
}

const TODAY = new Date('2026-06-15T08:00:00Z');

describe('igloo-helpers', () => {
  describe('TC-01 normalizePhone', () => {
    it('normalizes +84 / 84 / spaces / dashes to 0xxxxxxxxx', () => {
      expect(normalizePhone('+84 901 234 567')).toBe('0901234567');
      expect(normalizePhone('0901234567')).toBe('0901234567');
      expect(normalizePhone('84901234567')).toBe('0901234567');
      expect(normalizePhone('090-123-4567')).toBe('0901234567');
    });
    it('returns null for invalid phone', () => {
      expect(normalizePhone('12-3')).toBeNull();
      expect(normalizePhone('')).toBeNull();
      expect(normalizePhone(null)).toBeNull();
      expect(normalizePhone('1234567890')).toBeNull(); // không bắt đầu bằng 0
    });
  });

  describe('TC-02 isValidIdCard (9 & 12 digits, no foreign passport)', () => {
    it('accepts 9 (CMND) and 12 (CCCD) digits', () => {
      expect(isValidIdCard('012345678')).toBe(true);
      expect(isValidIdCard('092124584349')).toBe(true);
    });
    it('rejects non-digit / wrong length (passport, foreign)', () => {
      expect(isValidIdCard('A1234567')).toBe(false);
      expect(isValidIdCard('12345')).toBe(false);
      expect(isValidIdCard('1234567890123')).toBe(false); // 13 số
      expect(isValidIdCard(null)).toBe(false);
    });
  });

  describe('TC-03 derivePackageCode — always ROAD (Danny override)', () => {
    it('returns ROAD regardless of race_type', () => {
      expect(derivePackageCode('TRAIL_RACE')).toBe('ROAD');
      expect(derivePackageCode('ULTRA_RAIL_RACE')).toBe('ROAD');
      expect(derivePackageCode('ROAD_MARATHON')).toBe('ROAD');
      expect(derivePackageCode('UNKNOWN')).toBe('ROAD');
      expect(derivePackageCode(null)).toBe('ROAD');
    });
  });

  describe('TC-04 computeCoverage — 1 day from event start', () => {
    it('to = from, totalDays = 1', () => {
      expect(computeCoverage('2026-07-10')).toEqual({
        from: '2026-07-10',
        to: '2026-07-10',
        totalDays: 1,
      });
    });
    it('returns null when start date invalid', () => {
      expect(computeCoverage(null)).toBeNull();
      expect(computeCoverage('not-a-date')).toBeNull();
    });
  });

  describe('TC-05 computePremium — flat 10000', () => {
    it('premium = premiumVat = totalPayment = 10000', () => {
      expect(computePremium()).toEqual({
        premium: 10000,
        premiumVat: 10000,
        totalPayment: 10000,
      });
    });
  });

  describe('TC-06 isEligible — rejects', () => {
    it('rejects gender OTHER/null', () => {
      expect(isEligible(row({ gender: 'OTHER' }), TODAY)).toBe(false);
      expect(isEligible(row({ gender: null }), TODAY)).toBe(false);
    });
    it('rejects missing dob', () => {
      expect(isEligible(row({ dob: null }), TODAY)).toBe(false);
    });
    it('rejects invalid id_number (passport / foreign)', () => {
      expect(isEligible(row({ id_number: 'P1234567' }), TODAY)).toBe(false);
    });
    it('rejects invalid phone', () => {
      expect(isEligible(row({ contact_phone: 'abc' }), TODAY)).toBe(false);
    });
    it('rejects missing email', () => {
      expect(isEligible(row({ email: null }), TODAY)).toBe(false);
    });
    it('rejects past event (event_start_date < today)', () => {
      expect(isEligible(row({ event_start_date: '2026-06-14' }), TODAY)).toBe(
        false,
      );
    });
    it('rejects null event_start_date', () => {
      expect(isEligible(row({ event_start_date: null }), TODAY)).toBe(false);
    });
  });

  describe('TC-07 isEligible — happy', () => {
    it('accepts full KYC + upcoming race (start = today is allowed)', () => {
      expect(isEligible(row(), TODAY)).toBe(true);
      expect(isEligible(row({ event_start_date: '2026-06-15' }), TODAY)).toBe(
        true,
      );
    });
  });

  describe('TC-08 buildPartnerRefId', () => {
    it('formats igloo:<athletesId>:<raceId>', () => {
      expect(buildPartnerRefId(101, 220)).toBe('igloo:101:220');
    });
  });

  describe('TC-09 buildIglooPayload — shape', () => {
    it('builds correct payload (ROAD, 1-day, flat 10k, full PII, address joined)', () => {
      const p = buildIglooPayload(row());
      expect(p.partnerRefId).toBe('igloo:101:220');
      // insured
      expect(p.insured).toEqual({
        name: 'Nguyễn Văn A',
        dateOfBirth: '1992-06-27',
        gender: 'MALE',
        idCard: '092124584349', // FULL, không mask
        email: 'a@example.com',
        phone: '0901234567',
        address: '435/10 Nguyễn Du, Thủ Đức, TP. Hồ Chí Minh',
      });
      // coverage
      expect(p.coverage).toEqual({
        from: '2026-07-10',
        to: '2026-07-10',
        packageCode: 'ROAD',
        premium: 10000,
        premiumVat: 10000,
      });
      // requester = insured + relationCode INSURED
      expect(p.requester.relationCode).toBe('INSURED');
      expect(p.requester.idCard).toBe('092124584349');
      // tournament
      expect(p.tournament).toEqual({
        name: 'LÀO CAI MARATHON 2026',
        bibNumber: '1234',
        distance: '21KM',
      });
    });

    it('falls back address to "Việt Nam" when no location parts', () => {
      const p = buildIglooPayload(
        row({ location: null, district: null, province: null }),
      );
      expect(p.insured.address).toBe('Việt Nam');
    });

    it('throws when a required field missing (defensive)', () => {
      expect(() => buildIglooPayload(row({ id_number: 'BAD' }))).toThrow();
    });
  });

  describe('normalizeGender + toYmd', () => {
    it('normalizeGender uppercases + filters', () => {
      expect(normalizeGender('male')).toBe('MALE');
      expect(normalizeGender('Female')).toBe('FEMALE');
      expect(normalizeGender('OTHER')).toBeNull();
    });
    it('toYmd handles Date and string', () => {
      expect(toYmd('2026-07-10T00:00:00.000Z')).toBe('2026-07-10');
      expect(toYmd(new Date(2026, 6, 10))).toBe('2026-07-10');
      expect(toYmd(null)).toBeNull();
    });
  });
});
